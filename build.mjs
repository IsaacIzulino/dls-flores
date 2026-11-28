import { cpSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readCatalog } from "./catalog-data.mjs";

const path = (file) => fileURLToPath(new URL(file, import.meta.url));
const template = readFileSync(path("index.html"), "utf8");
const { flowers } = JSON.parse(readFileSync(path("flores.json"), "utf8"));
const catalog = readCatalog(flowers);
for (const flower of catalog) {
  if (!statSync(path(flower.image.slice(1)), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`${flower.name}: a foto selecionada não está no repositório.`);
  }
}

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
for (const file of ["assets", "style.css", "catalogo.js", "flor.html", "admin.html", "admin.css", "admin.js"]) {
  cpSync(path(file), path(`dist/${file}`), { recursive: true });
}
