// A deliberately messy sample mission. Try loading this from the app!
const playerName = 'Pixel Hero';
const coins = 25;
const unusedBonus = 100;

function greet(name) {
  if (name == 'Pixel Hero') {
    console.log('Welcome, ' + name);
  }
}

greet(playerName);
console.log('Coins:', coins);
