// import libraries socket.io, express
const express = require("express");
const socketIO = require("socket.io");
const http = require("http");
const dateConverter = require("./utils/dateConverter")

const Application = express.application;
const SocketIOServer = socketIO.Server;
const createServer = http.createServer;
const HTTPServer = http.Server;

// creating Server handler class with methods
module.exports = class Server {
  constructor() {
    // Init attributes
    this.httpServer = HTTPServer;
    this.app = Application;
    this.io = SocketIOServer;
    this.rooms = new Map();

    // Call methods of Server to config and start our server
    this.initialize();
    this.handleRoutes();
    this.handleSocketConnection();
  }

  // Init our server
  initialize() {
    // use(express.json()) for json-data, express.json() parse and return json
    this.app = express().use(express.json());
    this.httpServer = createServer(this.app);
    // cors
    this.io = socketIO(this.httpServer, {
      cors: {
        origin: "*",
      },
    });
  }

  // Init server's routes
  handleRoutes() {
    this.app.get("/", (req, res) => {
      res.send(`<h1>Главная</h1>`);
    });
    this.app.get("/rooms/:id", (req, res) => {
      // With destruct get id of params :id
      const { id: roomId } = req.params;
      // if we have room in this.rooms we return users and messages else return users[] and messages[]
      const object = this.rooms.has(roomId)
        ? {
            users: [...this.rooms.get(roomId).get("users").values()],
            messages: [...this.rooms.get(roomId).get("messages").values()],
          }
        : { users: [], messages: [], video_peers: [] };
      res.json(object);
    });
    this.app.post("/rooms", (req, res) => {
      const { room, nickname } = req.body;
      // If we have not rooms add it
      if (!this.rooms.has(room)) {
        this.rooms.set(
          room,
          new Map([
            ["users", new Map()],
            ["messages", []],
          ])
        );
      }
      res.send();
    });
  }

  // Connection to Socket
  handleSocketConnection() {
    this.io.on("connection", (socket) => {
      // On join in room
      socket.on("room:join", ({ room, nickname }) => {
        // Request to currently room, not at all rooms
        socket.join(room);
        // Set user to rooms
        this.rooms.get(room).get("users").set(socket.id, nickname);
        // We need to get all users from this room
        const users = [...this.rooms.get(room).get("users").values()];
        const usersID = [...this.rooms.get(room).get("users").keys()];
        // In current room all needs sending request
        socket.to(room).emit("room:set_users", users);
        setTimeout(() => {
          socket.to(room).emit("room:create_peers", usersID);
        }, 1000);
      });

      // On message
      socket.on("room:new_message", ({ room, nickname, text, date }) => {
        const message = {
          nickname,
          text,
          date,
        };
        this.rooms.get(room).get("messages").push(message);
        socket.broadcast.to(room).emit("room:new_message", message);
      });

      // On video peers
      socket.on("peer:sending_signal", (payload) => {
        this.io.to(payload.userToSignal).emit("room:user_joined", {
          signal: payload.signal,
          callerID: payload.callerID,
        });
      });

      socket.on("peer:returning_signal", (payload) => {
        this.io.to(payload.callerID).emit("room:receiving_returned_signal", {
          signal: payload.signal,
          id: socket.id,
        });
      });

      // users's disconnect
      socket.on("disconnect", () => {
        this.rooms.forEach((value, room) => {
          // Save nickname, which we will delete
          const deletedNickName = value.get("users").get(socket.id);
          // If delete is successful
          if (value.get("users").delete(socket.id)) {
            // Getting actual data of users
            const users = [...value.get("users").values()];
            socket.broadcast.to(room).emit("room:set_users", users);
            socket.broadcast.to(room).emit("room:new_message", {
              room: room,
              nickname: "Админ Комнаты",
              text: `${deletedNickName}, вышел из комнаты.`,
              date: dateConverter(new Date()),
            });
            // Not working
            // socket.to(room).emit("room:user_left", socket.id);
          }
        });
      });
    });
  }

  listen(callback) {
    this.httpServer.listen(process.env.DEFAULT_PORT, () =>
      callback(process.env.DEFAULT_PORT)
    );
  }
};
