const status = document.querySelector("#admin-status");
const login = document.querySelector("#admin-login");
const password = document.querySelector("#admin-password");
const catalog = document.querySelector("#admin-catalog");
const list = document.querySelector("#admin-list");
const editor = document.querySelector("#admin-editor");
const editorTitle = document.querySelector("#admin-editor-title");
const photo = document.querySelector("#admin-photo");
const preview = document.querySelector("#admin-photo-preview");
const saveStatus = document.querySelector("#admin-save-status");
const addFlower = document.querySelector("#admin-new");
const logout = document.querySelector("#admin-logout");
const priceFields = ["single", "trio", "quintet"];
const field = (name) => editor.elements.namedItem(name);
let flowers;
let version;
let selected;
let previewUrl;

async function request(body) {
  const response = await fetch("/api/admin", body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(data.message), { status: response.status });
  }
  return data;
}

function showSessionError(error) {
  catalog.hidden = true;
  login.hidden = error.status !== 401;
  status.textContent = error.message || "Não foi possível abrir o painel.";
}

function setPreview(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = file ? URL.createObjectURL(file) : undefined;
  const savedImage = flowers[selected]?.image;
  const source = previewUrl || savedImage?.split("/").map(encodeURIComponent).join("/");
  preview.hidden = !source;
  if (source) preview.src = source;
  else preview.removeAttribute("src");
}

function openEditor(index) {
  selected = index;
  editor.reset();
  saveStatus.textContent = "";
  const flower = flowers[index];
  editorTitle.textContent = flower?.name || "Nova flor";
  field("name").value = flower?.name || "";
  field("alt").value = flower?.alt || "";
  field("illustrative").checked = Boolean(flower?.illustrative);
  priceFields.forEach((name) => { field(name).value = flower?.[name] ?? ""; });
  photo.required = index === null;
  setPreview();
  [...list.querySelectorAll("button")].forEach((button, position) => {
    button.setAttribute("aria-pressed", String(position === index));
  });
}

function showCatalog(data, index = 0) {
  flowers = data.flowers;
  version = data.version;
  status.textContent = "";
  login.hidden = true;
  catalog.hidden = false;
  list.replaceChildren(...flowers.map((flower, position) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-secondary";
    button.textContent = flower.name;
    button.addEventListener("click", () => openEditor(position));
    item.append(button);
    return item;
  }));
  openEditor(index);
}

async function encodePhoto(file) {
  if (file.size > 20_000_000) throw new Error("Escolha uma foto de até 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("Não foi possível abrir a foto. Tente uma imagem JPG, PNG ou WebP.");
    }
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

login.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.submitter.disabled = true;
  status.textContent = "Entrando…";
  try {
    await request({ action: "login", password: password.value });
    password.value = "";
    showCatalog(await request());
  } catch (error) {
    showSessionError(error);
  } finally {
    event.submitter.disabled = false;
  }
});

logout.addEventListener("click", async () => {
  logout.disabled = true;
  try {
    await request({ action: "logout" });
    editor.reset();
    list.replaceChildren();
    flowers = [];
    version = undefined;
    setPreview();
    showSessionError({ status: 401, message: "Você saiu do painel." });
    password.focus();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    logout.disabled = false;
  }
});

addFlower.addEventListener("click", () => {
  openEditor(null);
  field("name").focus();
});

photo.addEventListener("change", () => {
  setPreview(photo.files[0]);
  if (photo.files.length) field("illustrative").checked = false;
});

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  const controls = catalog.querySelectorAll("button, input");
  controls.forEach((control) => { control.disabled = true; });
  saveStatus.textContent = "Salvando no catálogo…";

  try {
    const flower = {
      name: field("name").value,
      alt: field("alt").value,
      illustrative: field("illustrative").checked,
    };
    priceFields.forEach((name) => { flower[name] = field(name).valueAsNumber; });
    if (photo.files.length) flower.photo = await encodePhoto(photo.files[0]);
    const data = await request({ action: "save", version, index: selected, flower });
    showCatalog(data, data.index);
    saveStatus.textContent = "Salvo. O site será atualizado após a publicação na Vercel.";
  } catch (error) {
    if (error.status === 401) showSessionError(error);
    else saveStatus.textContent = error.message;
  } finally {
    controls.forEach((control) => { control.disabled = false; });
  }
});

request().then((data) => showCatalog(data)).catch(showSessionError);
