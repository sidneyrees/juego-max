// ----- Conectamos con el dibujo (canvas) -----
const lienzo = document.getElementById("lienzo");
const ctx = lienzo.getContext("2d");

const barraHambreEl = document.getElementById("barraHambre");
const barraSedEl = document.getElementById("barraSed");
const tiempoEl = document.getElementById("tiempo");
const tiempoFinalEl = document.getElementById("tiempoFinal");
const motivoMuerteEl = document.getElementById("motivoMuerte");
const pantallaFin = document.getElementById("pantallaFin");
const botonReiniciar = document.getElementById("botonReiniciar");
const estadoCongeladoEl = document.getElementById("estadoCongelado");
const segundosCongeladoEl = document.getElementById("segundosCongelado");

// ----- Nuestro countryball: Argentina -----
const countryballmax = {
  x: lienzo.width / 2,
  y: lienzo.height / 2,
  radio: 28,
  velocidad: 4,
  pais: "argentina",
  tag: "el mejor countryball de la historia",
  congelado: false,
  congeladoHasta: 0
};

// ----- El fantasma enemigo (estilo Pac-Man) -----
const fantasma = {
  x: 80,
  y: 80,
  radio: 22,
  velocidad: 2.3,
  dx: 1,
  dy: 0,
  proximoCambio: 0
};

const SEGUNDOS_CONGELADO = 5;

// Hambre y sed van de 0 a 100. Si llegan a 0, el countryball muere.
let hambre = 100;
let sed = 100;

// Cuánto bajan por segundo (sin comer ni beber)
const BAJA_HAMBRE_POR_SEG = 2.2;
const BAJA_SED_POR_SEG = 3;

// Cuánto suben al comer/beber
const SUBE_AL_COMER = 30;
const SUBE_AL_BEBER = 35;

let frutas = []; // nomnom y pomnom
let bebidas = []; // drinks
let juegoTerminado = false;
let segundosSobrevividos = 0;

// ----- Controles con las flechas -----
const teclas = {};
window.addEventListener("keydown", (e) => { teclas[e.key] = true; });
window.addEventListener("keyup", (e) => { teclas[e.key] = false; });

// ----- Controles táctiles para celular (los botones funcionan igual que las flechas) -----
function configurarBotonMovil(boton, tecla) {
  const presionar = (e) => { e.preventDefault(); teclas[tecla] = true; };
  const soltar = (e) => { e.preventDefault(); teclas[tecla] = false; };

  boton.addEventListener("touchstart", presionar);
  boton.addEventListener("touchend", soltar);
  boton.addEventListener("touchcancel", soltar);
  boton.addEventListener("mousedown", presionar);
  boton.addEventListener("mouseup", soltar);
  boton.addEventListener("mouseleave", soltar);
}

configurarBotonMovil(document.getElementById("btnArriba"), "ArrowUp");
configurarBotonMovil(document.getElementById("btnAbajo"), "ArrowDown");
configurarBotonMovil(document.getElementById("btnIzquierda"), "ArrowLeft");
configurarBotonMovil(document.getElementById("btnDerecha"), "ArrowRight");

// ----- Registrar el service worker para que la app funcione sin internet -----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ----- Crear comida y bebida en lugares al azar -----
function posicionAlAzar() {
  return {
    x: 40 + Math.random() * (lienzo.width - 80),
    y: 40 + Math.random() * (lienzo.height - 80)
  };
}

function crearFruta(tipo) {
  const pos = posicionAlAzar();
  frutas.push({ tipo: tipo, x: pos.x, y: pos.y, radio: 16 });
}

function crearBebida() {
  const pos = posicionAlAzar();
  bebidas.push({ x: pos.x, y: pos.y, radio: 16 });
}

// Arrancamos con algunas frutas y bebidas en el mapa
function poblarMapaInicial() {
  frutas = [];
  bebidas = [];
  for (let i = 0; i < 3; i++) crearFruta("nomnom");
  for (let i = 0; i < 3; i++) crearFruta("pomnom");
  for (let i = 0; i < 3; i++) crearBebida();
}

// ----- Distancia entre dos puntos, para saber si se tocan -----
function distancia(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// ----- Mover al fantasma: a veces persigue, a veces deambula -----
function elegirNuevaDireccionFantasma(perseguirJugador) {
  let angulo;
  if (perseguirJugador) {
    const anguloHaciaJugador = Math.atan2(countryballmax.y - fantasma.y, countryballmax.x - fantasma.x);
    angulo = anguloHaciaJugador + (Math.random() - 0.5) * (Math.PI / 2);
  } else {
    angulo = Math.random() * Math.PI * 2;
  }
  fantasma.dx = Math.cos(angulo);
  fantasma.dy = Math.sin(angulo);
}

function moverFantasma(momentoActual) {
  if (momentoActual >= fantasma.proximoCambio) {
    elegirNuevaDireccionFantasma(Math.random() < 0.5);
    fantasma.proximoCambio = momentoActual + 1000 + Math.random() * 2000;
  }

  fantasma.x += fantasma.dx * fantasma.velocidad;
  fantasma.y += fantasma.dy * fantasma.velocidad;

  const r = fantasma.radio;
  if (fantasma.x < r) { fantasma.x = r; fantasma.dx = Math.abs(fantasma.dx); }
  if (fantasma.x > lienzo.width - r) { fantasma.x = lienzo.width - r; fantasma.dx = -Math.abs(fantasma.dx); }
  if (fantasma.y < r) { fantasma.y = r; fantasma.dy = Math.abs(fantasma.dy); }
  if (fantasma.y > lienzo.height - r) { fantasma.y = lienzo.height - r; fantasma.dy = -Math.abs(fantasma.dy); }
}

// ----- Si el fantasma toca al countryball, lo congela 5 segundos -----
function revisarColisionFantasma(momentoActual) {
  if (countryballmax.congelado) return;
  if (distancia(countryballmax.x, countryballmax.y, fantasma.x, fantasma.y) < countryballmax.radio + fantasma.radio) {
    countryballmax.congelado = true;
    countryballmax.congeladoHasta = momentoActual + SEGUNDOS_CONGELADO * 1000;
  }
}

// ----- Mover al countryball según las flechas apretadas -----
function moverCountryball() {
  if (countryballmax.congelado) return; // congelado: no se puede mover

  let dx = 0, dy = 0;
  if (teclas["ArrowUp"]) dy -= 1;
  if (teclas["ArrowDown"]) dy += 1;
  if (teclas["ArrowLeft"]) dx -= 1;
  if (teclas["ArrowRight"]) dx += 1;

  // si se mueve en diagonal, que no vaya más rápido
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  countryballmax.x += dx * countryballmax.velocidad;
  countryballmax.y += dy * countryballmax.velocidad;

  // que no se salga del canvas
  const r = countryballmax.radio;
  countryballmax.x = Math.max(r, Math.min(lienzo.width - r, countryballmax.x));
  countryballmax.y = Math.max(r, Math.min(lienzo.height - r, countryballmax.y));
}

// ----- Revisar si el countryball agarró comida o bebida -----
function revisarColisiones() {
  // nomnom / pomnom fruit
  for (let i = frutas.length - 1; i >= 0; i--) {
    const f = frutas[i];
    if (distancia(countryballmax.x, countryballmax.y, f.x, f.y) < countryballmax.radio + f.radio) {
      frutas.splice(i, 1); // la fruta desaparece
      hambre = Math.min(100, hambre + SUBE_AL_COMER); // se rellena la barra de hambre
      crearFruta(f.tipo); // aparece otra en otro lugar
    }
  }

  // drink
  for (let i = bebidas.length - 1; i >= 0; i--) {
    const b = bebidas[i];
    if (distancia(countryballmax.x, countryballmax.y, b.x, b.y) < countryballmax.radio + b.radio) {
      bebidas.splice(i, 1); // la bebida desaparece
      sed = Math.min(100, sed + SUBE_AL_BEBER); // se rellena la barra de sed
      crearBebida(); // aparece otra en otro lugar
    }
  }
}

// ----- Dibujar el countryball de Argentina -----
function dibujarCountryball() {
  const { x, y, radio } = countryballmax;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // bandera argentina: celeste, blanco, celeste
  ctx.fillStyle = "#75AADB";
  ctx.fillRect(x - radio, y - radio, radio * 2, (radio * 2) / 3);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x - radio, y - radio + (radio * 2) / 3, radio * 2, (radio * 2) / 3);
  ctx.fillStyle = "#75AADB";
  ctx.fillRect(x - radio, y - radio + (radio * 4) / 3, radio * 2, (radio * 2) / 3);
  ctx.restore();

  // sol en el medio
  ctx.beginPath();
  ctx.fillStyle = "#FCBF49";
  ctx.arc(x, y, radio * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // borde negro
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "black";
  ctx.stroke();

  // ojos
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(x - radio * 0.32, y - radio * 0.05, radio * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + radio * 0.32, y - radio * 0.05, radio * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // sonrisa
  ctx.beginPath();
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.arc(x, y + radio * 0.05, radio * 0.35, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // si está congelado, se ve un hielo arriba y un brillo celeste
  if (countryballmax.congelado) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(173, 216, 230, 0.55)";
    ctx.arc(x, y, radio + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("❄️", x, y - radio - 16);
  }
}

// ----- Dibujar el fantasma estilo Pac-Man -----
function dibujarFantasma() {
  const { x, y, radio: r, dx, dy } = fantasma;

  ctx.beginPath();
  ctx.fillStyle = "#ff4d4d";
  ctx.arc(x, y, r, Math.PI, 0, false);
  ctx.lineTo(x + r, y + r * 0.7);
  ctx.lineTo(x + r * 0.66, y + r * 0.4);
  ctx.lineTo(x + r * 0.33, y + r * 0.7);
  ctx.lineTo(x, y + r * 0.4);
  ctx.lineTo(x - r * 0.33, y + r * 0.7);
  ctx.lineTo(x - r * 0.66, y + r * 0.4);
  ctx.lineTo(x - r, y + r * 0.7);
  ctx.closePath();
  ctx.fill();

  const miraX = Math.max(-1, Math.min(1, dx)) * r * 0.12;
  const miraY = Math.max(-1, Math.min(1, dy)) * r * 0.12;

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.05, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.35, y - r * 0.05, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a4fa3";
  ctx.beginPath();
  ctx.arc(x - r * 0.35 + miraX, y - r * 0.05 + miraY, r * 0.1, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35 + miraX, y - r * 0.05 + miraY, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function dibujarFrutas() {
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of frutas) {
    ctx.fillText(f.tipo === "nomnom" ? "🍎" : "🍐", f.x, f.y);
  }
}

function dibujarBebidas() {
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of bebidas) {
    ctx.fillText("🥤", b.x, b.y);
  }
}

function dibujarTodo() {
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  dibujarFrutas();
  dibujarBebidas();
  dibujarFantasma();
  dibujarCountryball();
}

// ----- Actualizar las barras de hambre y sed en la pantalla -----
function actualizarBarras() {
  barraHambreEl.style.width = hambre + "%";
  barraSedEl.style.width = sed + "%";
}

// ----- Mostrar el aviso de "congelado" con la cuenta regresiva -----
function actualizarEstadoCongelado(momentoActual) {
  if (countryballmax.congelado) {
    estadoCongeladoEl.classList.remove("oculto");
    const restante = Math.max(0, Math.ceil((countryballmax.congeladoHasta - momentoActual) / 1000));
    segundosCongeladoEl.textContent = restante;
  } else {
    estadoCongeladoEl.classList.add("oculto");
  }
}

// ----- Terminar el juego -----
function morir(motivo) {
  juegoTerminado = true;
  motivoMuerteEl.textContent = motivo;
  tiempoFinalEl.textContent = segundosSobrevividos;
  pantallaFin.classList.remove("oculto");
}

// ----- El bucle del juego: se repite muchas veces por segundo -----
let ultimoMomento = performance.now();
let acumuladorSegundo = 0;

function bucleJuego(momentoActual) {
  if (juegoTerminado) return;

  const deltaSeg = (momentoActual - ultimoMomento) / 1000;
  ultimoMomento = momentoActual;

  // bajan hambre y sed con el tiempo
  hambre -= BAJA_HAMBRE_POR_SEG * deltaSeg;
  sed -= BAJA_SED_POR_SEG * deltaSeg;
  hambre = Math.max(0, hambre);
  sed = Math.max(0, sed);

  // si ya pasaron los 5 segundos, se descongela
  if (countryballmax.congelado && momentoActual >= countryballmax.congeladoHasta) {
    countryballmax.congelado = false;
  }

  moverCountryball();
  moverFantasma(momentoActual);
  revisarColisiones();
  revisarColisionFantasma(momentoActual);
  dibujarTodo();
  actualizarBarras();
  actualizarEstadoCongelado(momentoActual);

  // contador de segundos sobrevividos
  acumuladorSegundo += deltaSeg;
  if (acumuladorSegundo >= 1) {
    segundosSobrevividos += Math.floor(acumuladorSegundo);
    acumuladorSegundo = acumuladorSegundo % 1;
    tiempoEl.textContent = segundosSobrevividos;
  }

  if (hambre <= 0) {
    morir("Se le acabó la comida... ¡murió de hambre! 🍎");
    return;
  }
  if (sed <= 0) {
    morir("Se le acabó el agua... ¡murió de sed! 💧");
    return;
  }

  requestAnimationFrame(bucleJuego);
}

// ----- Empezar / reiniciar el juego -----
function iniciarJuego() {
  hambre = 100;
  sed = 100;
  segundosSobrevividos = 0;
  acumuladorSegundo = 0;
  juegoTerminado = false;
  countryballmax.x = lienzo.width / 2;
  countryballmax.y = lienzo.height / 2;
  countryballmax.congelado = false;
  countryballmax.congeladoHasta = 0;
  fantasma.x = 80;
  fantasma.y = 80;
  fantasma.dx = 1;
  fantasma.dy = 0;
  fantasma.proximoCambio = 0;
  poblarMapaInicial();
  tiempoEl.textContent = "0";
  estadoCongeladoEl.classList.add("oculto");
  pantallaFin.classList.add("oculto");
  ultimoMomento = performance.now();
  requestAnimationFrame(bucleJuego);
}

botonReiniciar.addEventListener("click", iniciarJuego);

iniciarJuego();
