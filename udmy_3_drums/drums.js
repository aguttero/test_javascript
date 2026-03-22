// TEST Code
// alert("js link test ok");

// document.querySelector("button").addEventListener("click", handleClick);

// with anonimous function:
// document.querySelector("button").addEventListener("click", function () {
//     alert("Clickeeed!");
// });

// para todos los botones con querySelectorAll
// 1. Seleccionamos todos los botones
// const botones = document.querySelectorAll("button");

// // 2. Recorremos cada botón de la lista
// botones.forEach(function(boton) {
//     // 3. Le asignamos el evento a "cada uno"
//     boton.addEventListener("click", function() {
//         alert("¡Hiciste clic en un botón!");
//     });
// });

// 3. For loop - Tradicional
var numberOfButtons = document.querySelectorAll(".drum").length;

for (var i = 0; i < document.querySelectorAll(".drum").length; i++) {
    document.querySelectorAll(".drum")[i].addEventListener("click", function () {
        this.style.color = "white";
        console.log(this.innerHTML);
        console.log(this.innerText);
        var audio = new Audio("sounds/tom-1.mp3");
        audio.play();

        // alert("FOR Clickeeed!");
    })
}

function handleClick() {
    alert("Clicked!");
}