function mostrarToast(mensaje, tipo = "exito") {

  const estilos = {
    exito: {
      bg:    "bg-green-100 border border-green-500",
      texto: "text-green-800",
      icono: "✅"
    },
    error: {
      bg:    "bg-red-100 border border-red-500",
      texto: "text-red-800",
      icono: "❗"
    },
    info: {
      bg:    "bg-pink-100 border border-pink-500",
      texto: "text-pink-800",
      icono: "💖"
    },
  };

  const e = estilos[tipo];

  const toast = document.createElement("div");
  toast.className = `
    fixed top-6 left-1/2 -translate-x-1/2
    ${e.bg} ${e.texto}
    px-5 py-3 rounded-xl shadow-md
    flex items-center gap-3
    text-sm font-semibold
    z-[9999]
    opacity-0 -translate-y-4
    transition-all duration-300 ease-in-out
    whitespace-nowrap
  `;

  toast.innerHTML = `<span>${mensaje}</span><span>${e.icono}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("opacity-0", "-translate-y-4");
    toast.classList.add("opacity-100", "translate-y-0");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "-translate-y-4");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export { mostrarToast };