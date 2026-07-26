/* Genera el hash bcrypt de una contraseña para pegarlo en .env como
   ADMIN_PASSWORD_HASH. Uso:
     npm run hash-admin-pass -- "tu-contraseña-aqui"
   o simplemente:
     npm run hash-admin-pass
   (te la pedirá de forma interactiva, sin mostrarla en pantalla) */
const bcrypt = require('bcryptjs');
const readline = require('readline');

async function main() {
  const argPass = process.argv[2];
  if (argPass) {
    const hash = await bcrypt.hash(argPass, 12);
    console.log('\nADMIN_PASSWORD_HASH=' + hash + '\n');
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Escribe la contraseña de admin que quieres usar: ', async (pass) => {
    const hash = await bcrypt.hash(pass, 12);
    console.log('\nCopia esta línea completa dentro de tu archivo .env:\n');
    console.log('ADMIN_PASSWORD_HASH=' + hash + '\n');
    rl.close();
  });
}

main();
