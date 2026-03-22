// TEST Code
// alert("js link test ok");

document.querySelector("button").addEventListener("click", handleClick);

// with anonimous function:
document.querySelector("button").addEventListener("click", function () {
    alert("Clickeeed!");
});

// para todos los botones con querySelectorAll
// 1. Seleccionamos todos los botones
const botones = document.querySelectorAll("button");

// 2. Recorremos cada botón de la lista
botones.forEach(function(boton) {
    // 3. Le asignamos el evento a "cada uno"
    boton.addEventListener("click", function() {
        alert("¡Hiciste clic en un botón!");
    });
});

// 3. For Tradicional
for (var i = 0; i < document.querySelectorAll(".drum").length; i++) {
    document.querySelectorAll("button")[i].addEventListener("click", function () {
        alert("FOR Clickeeed!");
    })
}


function handleClick() {
    alert("Clicked!");
}