const gallery = document.querySelector(".gallery-grid");
const dialog = document.querySelector(".product-dialog");
const form = dialog.querySelector(".product-form");
const title = dialog.querySelector("#product-title");
const priceLabels = dialog.querySelectorAll("[data-price]");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const whatsapp = new URL(document.querySelector(".whatsapp-link").href);
whatsapp.search = "";
form.action = whatsapp.href;

let selectedFlower;

gallery.addEventListener("click", (event) => {
  const button = event.target.closest(".gallery-button");
  if (!button) return;

  const prices = button.dataset.prices.split(" ").map(Number);
  selectedFlower = button.dataset.flower;
  title.textContent = button.closest(".gallery-card").querySelector("h3").textContent;
  priceLabels.forEach((label, index) => {
    label.textContent = currency.format(prices[index]);
  });

  form.reset();
  dialog.showModal();
});

dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());

form.addEventListener("formdata", (event) => {
  const format = event.formData.get("formato");
  event.formData.delete("formato");
  event.formData.set("text", `Olá, DLS Flores! Vim pelo site e tenho interesse ${selectedFlower} (${format}).`);
});
