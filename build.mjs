import { cpSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (file) => fileURLToPath(new URL(file, import.meta.url));
const template = readFileSync(path("index.html"), "utf8");
const { flowers } = JSON.parse(readFileSync(path("flores.json"), "utf8"));
const addresses = new Set(["inicio", "conteudo", "buques", "sobre"]);

if (!Array.isArray(flowers) || flowers.length === 0) {
  throw new Error("O catálogo precisa de pelo menos uma flor.");
}

const catalog = flowers.map((entry, index) => {
  const name = entry.name?.trim();
  const address = entry.slug?.trim() || name?.toLowerCase()
    .normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  const key = address?.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const label = name || `Flor ${index + 1}`;

  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key ?? "") || addresses.has(key)) {
    throw new Error(`${label}: use um nome e um endereço único, com letras, números ou hífens.`);
  }
  addresses.add(key);

  const imagePath = entry.image;
  if (typeof imagePath !== "string" || !/^\/assets\/flores\/(?:[\p{L}\p{N}_ -]+\/)*[\p{L}\p{N}_ .-]+\.(jpg|jpeg|png|webp|avif)$/iu.test(imagePath)) {
    throw new Error(`${label}: selecione uma foto da pasta de fotos do catálogo.`);
  }
  const image = imagePath.split("/").map(encodeURIComponent).join("/");
  if (!statSync(path(image.slice(1)), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`${label}: a foto selecionada não está no repositório.`);
  }

  const prices = [entry.single, entry.trio, entry.quintet];
  if (prices.some((price) => !Number.isFinite(price) || price < 0)) {
    throw new Error(`${label}: informe preços válidos para as três opções.`);
  }

  return {
    key, address, name, image, prices,
    alt: entry.alt?.trim() || `${name} de chenille`,
    interest: entry.interest?.trim() || `em ${name}`,
    illustrative: entry.illustrative === true,
  };
});

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value) => value.replace(/[&<>"]/g, (character) => entities[character]);
const cards = catalog.map((flower) => {
  const name = escapeHtml(flower.name);
  const photoLabel = flower.illustrative
    ? '\n              <span class="gallery-photo-label">Imagem ilustrativa</span>' : "";
  return `<li class="gallery-card">
            <a class="gallery-card-link" href="#${encodeURIComponent(flower.address)}" data-model="${flower.key}" aria-label="Ver mais sobre ${name}">
              <img src="${flower.image}" width="720" height="720" alt="${escapeHtml(flower.alt)}" loading="lazy" decoding="async">${photoLabel}
              <div class="gallery-card-content">
                <h3>${name}</h3>
                <span class="gallery-button">Ver mais <svg class="arrow-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 8h11m-4.5-4.5L13.5 8 9 12.5"/></svg></span>
              </div>
            </a>
          </li>`;
});

const output = template
  .replace("<!-- catalog-cards -->", () => cards.join("\n          "))
  .replace("<!-- catalog-data -->", () => JSON.stringify(catalog).replace(/</g, "\\u003c"));

mkdirSync(path("dist"), { recursive: true });
writeFileSync(path("dist/index.html"), output);
for (const file of ["assets", "style.css", "catalogo.js", "flor.html"]) {
  cpSync(path(file), path(`dist/${file}`), { recursive: true });
}
