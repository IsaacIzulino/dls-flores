export function flowerAddress(name, slug) {
  const address = slug?.trim() || name?.toLowerCase()
    .normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  const key = address?.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return { address, key };
}

export function readCatalog(entries) {
  const addresses = new Set(["inicio", "conteudo", "buques", "sobre"]);
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("O catálogo precisa de pelo menos uma flor.");
  }

  return entries.map((entry, index) => {
    const name = entry.name?.trim();
    const { address, key } = flowerAddress(name, entry.slug);
    const label = name || `Flor ${index + 1}`;
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key ?? "") || addresses.has(key)) {
      throw new Error(`${label}: use um nome e um endereço único, com letras, números ou hífens.`);
    }
    addresses.add(key);

    const imagePath = entry.image;
    if (typeof imagePath !== "string" || !/^\/assets\/flores\/(?:[\p{L}\p{N}_ -]+\/)*[\p{L}\p{N}_ .-]+\.(jpg|jpeg|png|webp|avif)$/iu.test(imagePath)) {
      throw new Error(`${label}: selecione uma foto da pasta de fotos do catálogo.`);
    }
    const prices = [entry.single, entry.trio, entry.quintet];
    if (prices.some((price) => !Number.isFinite(price) || price < 0)) {
      throw new Error(`${label}: informe preços válidos para as três opções.`);
    }

    return {
      key, address, name, prices,
      image: imagePath.split("/").map(encodeURIComponent).join("/"),
      alt: entry.alt?.trim() || `${name} de chenille`,
      interest: entry.interest?.trim() || `em ${name}`,
      illustrative: entry.illustrative === true,
    };
  });
}
