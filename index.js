// root file with server init
require('dotenv').config();
const Server = require("./server");


const server = new Server();


server.listen((port) => {
  console.log(`Сервер находится на http://localhost:${port}`);
});
