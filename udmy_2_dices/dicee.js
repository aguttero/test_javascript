function randomDice(){
    var randomNumber = Math.floor(Math.random()*6)+1;
    return randomNumber;
}

// roll dices for each player:
dicePlayer1 = randomDice();
dicePlayer2 = randomDice();

// udpate dice image
// by using setAttrbute
//document.querySelector(".img1").setAttribute("src", "./images/dice4.png");

// using direct property .src
document.querySelector(".img1").src = `images/dice${dicePlayer1}.png`;
document.querySelector(".img2").src = `images/dice${dicePlayer2}.png`;

// update h1
if (dicePlayer1 === dicePlayer2) {
    document.querySelector("h1").innerText = "Draw";
} else if (dicePlayer1 > dicePlayer2) {
    document.querySelector("h1").innerText = "🚩 P1 wins!";
} else {
    document.querySelector("h1").innerText = "P2 wins! 🚩";

}

// TEST CODE
// for (var counter = 1; counter < 51; counter++){
//     console.log("dice "+counter, randomDice());

// 