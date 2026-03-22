function randomDice(){
    var randomNumber = Math.floor(Math.random()*6)+1
    return randomNumber;
}

for (var counter = 1; counter < 51; counter++){
    console.log("dice "+counter, randomDice());

}