import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { flowerAddress, readCatalog } from "../catalog-data.mjs";

const repository = "https://api.github.com/repos/IsaacIzulino/dls-flores";
const branch = "main";
const cookieName = "__Host-dls-admin";
const sessionSeconds = 8 * 60 * 60;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sameSecret(left, right) {
  const digest = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}

function sessionSignature(expires, password, token) {
  const key = createHmac("sha256", token).update(password).digest();
  return createHmac("sha256", key).update(`dls-admin:${expires}`).digest("base64url");
}

function sessionCookie(value, age) {
  return `${cookieName}=${value}; Max-Age=${age}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function signedIn(request, password, token) {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  const [, expires, signature] = cookie?.match(/=(\d{10})\.([a-zA-Z0-9_-]{43})$/) ?? [];
  return Boolean(expires && Number(expires) > Date.now() / 1000
    && sameSecret(signature, sessionSignature(expires, password, token)));
}

async function github(path, token, method = "GET", body) {
  const response = await fetch(repository + path, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    if (method === "PATCH" && [409, 422].includes(response.status)) {
      throw new RequestError(409, "Outra edição foi publicada. Recarregue o catálogo antes de salvar.");
    }
    throw new RequestError(502, "O GitHub não concluiu a operação. Verifique a conexão do painel e tente novamente.");
  }
  return response.json();
}

async function getCatalog(token, ref = branch) {
  const file = await github(`/contents/flores.json?ref=${ref}`, token);
  const { flowers } = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  return { version: file.sha, flowers };
}

function prepareChange(input, previous) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const alt = typeof input.alt === "string" ? input.alt.trim() : "";
  if (!name || name.length > 100 || alt.length > 180) {
    throw new RequestError(400, "Informe um nome e uma descrição válidos para a flor.");
  }

  const flower = {
    ...previous,
    name,
    alt,
    slug: flowerAddress(previous?.name ?? name, previous?.slug).address,
    illustrative: input.illustrative === true,
    single: input.single,
    trio: input.trio,
    quintet: input.quintet,
  };
  if (previous?.name !== name) delete flower.interest;

  let photo;
  if (input.photo !== undefined) {
    if (typeof input.photo !== "string" || input.photo.length > 1_800_000
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.photo)) {
      throw new RequestError(400, "A foto está grande demais ou tem formato inválido.");
    }
    const jpeg = Buffer.from(input.photo, "base64");
    if (jpeg.length < 4 || jpeg.readUInt16BE(0) !== 0xffd8 || jpeg.readUInt16BE(jpeg.length - 2) !== 0xffd9) {
      throw new RequestError(400, "Escolha uma foto válida.");
    }
    photo = input.photo;
    flower.image = `/assets/flores/${randomUUID()}.jpg`;
  }
  return { flower, photo };
}

async function saveFlower(input, token) {
  if (!input.flower || typeof input.flower !== "object" || Array.isArray(input.flower)) {
    throw new RequestError(400, "Informe os dados da flor.");
  }
  const ref = await github(`/git/ref/heads/${branch}`, token);
  const head = ref.object.sha;
  const catalog = await getCatalog(token, head);
  if (catalog.version !== input.version) {
    throw new RequestError(409, "O catálogo mudou depois que você o abriu. Recarregue e tente novamente.");
  }

  const index = input.index === null ? catalog.flowers.length : input.index;
  if (!Number.isInteger(index) || index < 0 || index > catalog.flowers.length
    || (input.index !== null && index === catalog.flowers.length)) {
    throw new RequestError(400, "Flor inválida. Abra o catálogo novamente.");
  }
  const { flower, photo } = prepareChange(input.flower, catalog.flowers[index]);
  catalog.flowers[index] = flower;
  try {
    readCatalog(catalog.flowers);
  } catch (error) {
    throw new RequestError(400, error.message);
  }

  const content = JSON.stringify({ flowers: catalog.flowers }, null, 2) + "\n";
  const [commit, catalogBlob, photoBlob] = await Promise.all([
    github(`/git/commits/${head}`, token),
    github("/git/blobs", token, "POST", { content, encoding: "utf-8" }),
    photo ? github("/git/blobs", token, "POST", { content: photo, encoding: "base64" }) : null,
  ]);
  const files = [{
    path: "flores.json", mode: "100644", type: "blob", sha: catalogBlob.sha,
  }];
  if (photoBlob) {
    files.push({ path: flower.image.slice(1), mode: "100644", type: "blob", sha: photoBlob.sha });
  }
  const tree = await github("/git/trees", token, "POST", { base_tree: commit.tree.sha, tree: files });
  const update = await github("/git/commits", token, "POST", {
    message: `Atualiza catálogo da DLS Flores: ${flower.name}`,
    tree: tree.sha,
    parents: [head],
  });
  await github(`/git/refs/heads/${branch}`, token, "PATCH", { sha: update.sha, force: false });
  return { version: catalogBlob.sha, flowers: catalog.flowers, index };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const password = process.env.DLS_ADMIN_PASSWORD;
  const token = process.env.DLS_GITHUB_TOKEN;

  try {
    if (!password || password.length < 24 || password.length > 256 || !token) {
      throw new RequestError(503, "O painel ainda precisa ser ativado pela administração da loja.");
    }
    if (!["GET", "POST"].includes(request.method)) {
      response.setHeader("Allow", "GET, POST");
      throw new RequestError(405, "Método inválido.");
    }
    const authenticated = signedIn(request, password, token);
    if (request.method === "GET") {
      if (!authenticated) throw new RequestError(401, "Entre para abrir o catálogo.");
      return response.status(200).json(await getCatalog(token));
    }

    if (!request.headers.host || request.headers.origin !== `https://${request.headers.host}`
      || request.headers["content-type"]?.split(";")[0] !== "application/json") {
      throw new RequestError(403, "Abra o painel da própria loja para continuar.");
    }
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new RequestError(400, "Dados inválidos.");
    }

    if (body.action === "login") {
      if (typeof body.password !== "string" || body.password.length > 256 || !sameSecret(body.password, password)) {
        throw new RequestError(401, "Senha incorreta.");
      }
      const expires = Math.floor(Date.now() / 1000) + sessionSeconds;
      response.setHeader("Set-Cookie", sessionCookie(`${expires}.${sessionSignature(expires, password, token)}`, sessionSeconds));
      return response.status(200).json({ ok: true });
    }
    if (body.action === "logout") {
      response.setHeader("Set-Cookie", sessionCookie("", 0));
      return response.status(200).json({ ok: true });
    }
    if (!authenticated) throw new RequestError(401, "Sua sessão terminou. Entre para continuar.");
    if (body.action !== "save") throw new RequestError(400, "Ação inválida.");
    return response.status(200).json(await saveFlower(body, token));
  } catch (error) {
    const message = error instanceof RequestError
      ? error.message : "O painel não conseguiu concluir a operação. Tente novamente.";
    return response.status(error instanceof RequestError ? error.status : 500).json({ message });
  }
}
