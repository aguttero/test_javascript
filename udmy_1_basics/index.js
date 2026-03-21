console.log("test")
getMilk(10);
function getMilk(moneyAmount) { 
    const milkCost = 1.5;
    var bottlesToBuy = Math.floor(moneyAmount/milkCost);
    // console.log("leaveHouse");
    // console.log("moveRight");
    // console.log("moveRight");
    // console.log("moveUp");
    // console.log("moveUp");
    // console.log("moveUp");
    // console.log("moveUp");
    // console.log("moveRight");
    console.log("moveRight");
    console.log("Buy " + bottlesToBuy + " bottles of milk");
    var randomPercentage = Math.floor(Math.random()*100)+1
    console.log("This is a Random %: " + randomPercentage +"%");
    if (randomPercentage > 80 && randomPercentage <90) {
        console.log ("Jackpot de 80 a 90%!!");
    } else {
        console.log ("path del else")
    }
    console.log("moveLeft");
    // comparadores === !== > >= 
    // comparador == no revisa si coincide el data type
    // && AND
    // || OR
    // ! NOT
    // console.log("moveLeft");
    // console.log("moveDown");
    // console.log("moveDown");
    // console.log("moveDown");
    // console.log("moveDown");
    // console.log("moveLeft");
    // console.log("moveLeft");
    console.log("enterHouse");
}
//countTo20();
function countTo20 (){
    var output = [];
    for (let count = 1 ; count <31; count++){
        //console.log("contador i: ",i);
        if (count % 3 === 0 && count % 5 === 0) {
            output.push("FizzBuzz");
        } else if (count % 3 === 0 ) {
            output.push("Fizz");
        } else if (count % 5 === 0 ) {
            output.push("Buzz");
        } else { 
            output.push(count);
        }
    }
    console.log("output: ",output);
}
// console.log("fibonacci: ",fibonacciSeries(7));
function fibonacciSeries (n) {
    var output = [];
    if (n === 1) {
        output = [0];
    } else if (n === 2) {
        output = [0,1];
    } else {
        output = [0,1]
        for (var i=2; i<n; i++) {
            output.push(output[output.length - 2]+output[output.length - 1]);
        }
    }
    return output;
}

// changeToInvisible("item")

function changeToInvisible (classItem){
    console.log(classItem)
    document.querySelector(classItem).classList.add("invisible")
    document.querySelector(classItem).classList.toggle("invisible")

}

