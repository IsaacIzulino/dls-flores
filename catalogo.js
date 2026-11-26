const flowers = new Map([
  ["lirio", { name: "Lírio", alt: "Lírio rosa de chenille", interest: "no lírio", prices: [15, 45, 70] }],
  ["gerbera", { name: "Gérbera", alt: "Gérbera rosa de chenille", interest: "na gérbera", prices: [13, 39, 60] }],
  ["tulipa", { name: "Tulipa", alt: "Tulipa rosa de chenille", interest: "na tulipa", prices: [14, 42, 67] }],
  ["lavanda", { name: "Lavanda", alt: "Ramo de lavanda roxa de chenille", interest: "na lavanda", prices: [8, 24, 38] }],
  ["rosa", { name: "Rosa", alt: "Rosa em tom rosa de chenille", interest: "na rosa", prices: [19, 57, 90] }],
  ["margarida-grande", { name: "Margarida grande", alt: "Margarida grande branca de chenille", interest: "na margarida grande", prices: [11, 33, 52] }],
  ["margarida-pequena", { name: "Margarida pequena", alt: "Margarida pequena branca de chenille", interest: "na margarida pequena", prices: [10, 30, 47] }],
]);

const slug = new URLSearchParams(window.location.search).get("modelo");
const flower = flowers.get(slug);

if (!flower) {
  document.querySelector(".product-empty").hidden = false;
} else {
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const image = document.querySelector("#product-image");
  const form = document.querySelector(".product-form");

  document.title = `${flower.name} de chenille | DLS Flores`;
  document.querySelector("#product-title").textContent = flower.name;
  image.alt = flower.alt;
  image.src = `assets/flores/${slug}.jpg`;
  form.querySelectorAll("[data-price]").forEach((label, index) => {
    label.textContent = currency.format(flower.prices[index]);
  });

  form.addEventListener("formdata", (event) => {
    const format = event.formData.get("formato");
    event.formData.delete("formato");
    event.formData.set("text", `Olá, DLS Flores! Vim pelo site e tenho interesse ${flower.interest} (${format}).`);
  });

  document.querySelector(".product-layout").hidden = false;
}
