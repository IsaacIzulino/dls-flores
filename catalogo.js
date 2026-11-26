const flowers = new Map([
  ["lirio", { name: "Lírio", alt: "Lírio rosa de chenille", interest: "no lírio", prices: [15, 45, 70] }],
  ["gerbera", { name: "Gérbera", alt: "Gérbera rosa de chenille", interest: "na gérbera", prices: [13, 39, 60] }],
  ["tulipa", { name: "Tulipa", alt: "Tulipa rosa de chenille", interest: "na tulipa", prices: [14, 42, 67] }],
  ["lavanda", { name: "Lavanda", alt: "Ramo de lavanda roxa de chenille", interest: "na lavanda", prices: [8, 24, 38] }],
  ["rosa", { name: "Rosa", alt: "Rosa em tom rosa de chenille", interest: "na rosa", prices: [19, 57, 90] }],
  ["margarida-grande", { name: "Margarida grande", alt: "Margarida grande branca de chenille", interest: "na margarida grande", prices: [11, 33, 52] }],
  ["margarida-pequena", { name: "Margarida pequena", alt: "Margarida pequena branca de chenille", interest: "na margarida pequena", prices: [10, 30, 47] }],
]);

const sections = document.querySelectorAll("#conteudo > section:not(.product-main)");
const product = document.querySelector(".product-main");
const heading = product.querySelector("#product-title");
const image = product.querySelector("#product-image");
const form = product.querySelector(".product-form");
const prices = form.querySelectorAll("[data-price]");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const homeTitle = document.title;
let activeSlug;

function readFragment() {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return "";
  }
}

function showCurrentView() {
  const fragment = readFragment();
  const slug = fragment.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const flower = flowers.get(slug);
  const previousSlug = activeSlug;
  activeSlug = flower ? slug : undefined;

  product.hidden = !flower;
  sections.forEach((section) => { section.hidden = Boolean(flower); });

  if (flower) {
    if (slug === previousSlug) return;

    document.title = `${flower.name} de chenille | DLS Flores`;
    heading.textContent = flower.name;
    image.alt = flower.alt;
    image.src = `assets/flores/${slug}.jpg`;
    prices.forEach((label, index) => {
      label.textContent = currency.format(flower.prices[index]);
    });
    form.reset();
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.focus({ preventScroll: true });
    return;
  }

  document.title = homeTitle;
  if (previousSlug) {
    const destination = document.getElementById(fragment || "buques");
    (destination ?? document.getElementById("buques")).scrollIntoView({ behavior: "instant" });
    if (!fragment || fragment === "buques") {
      const card = document.querySelector(`.gallery-card-link[data-model="${previousSlug}"]`);
      card?.scrollIntoView({ block: "nearest", behavior: "instant" });
      card?.focus({ preventScroll: true });
    }
  }
}

document.querySelector(".skip").addEventListener("click", (event) => {
  if (!activeSlug) return;
  event.preventDefault();
  heading.focus();
});

form.addEventListener("formdata", (event) => {
  const flower = flowers.get(activeSlug);
  const format = event.formData.get("formato");
  if (!flower || !format) return;

  event.formData.delete("formato");
  event.formData.set("text", `Olá, DLS Flores! Vim pelo site e tenho interesse ${flower.interest} (${format}).`);
});

window.addEventListener("hashchange", showCurrentView);
showCurrentView();
