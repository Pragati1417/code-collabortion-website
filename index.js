const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");
const axios = require("axios");
const server = http.createServer(app);
require("dotenv").config();
const path = require("path");
const { exec } = require("child_process");

const fs = require("fs");

app.use(cors());
app.use(express.json());

const dir = path.join(__dirname, "codes");
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

// 🔥 SOCKET SETUP

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});


const userSocketMap = {};
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
};

io.on("connection", (socket) => {
  // console.log('Socket connected', socket.id);
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    // notify that new user join
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  // sync the code
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });
  // when new user join the room all the code which are there are also shows on that persons editor
  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  // leave room
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    // leave all the room
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
    socket.leave();
  });
});


// 🔥 COMPILER API
app.post("/run", (req, res) => {
  const { code, language } = req.body;

  let file = "";
  let cmd = "";

  if (language === "python") {
    file = path.join(dir, "code.py");
    fs.writeFileSync(file, code);
    cmd = `python ${file}`;
  } 
  else if (language === "javascript") {
    file = path.join(dir, "code.js");
    fs.writeFileSync(file, code);
    cmd = `node ${file}`;
  } 
  else if (language === "cpp") {
    file = path.join(dir, "code.cpp");
    fs.writeFileSync(file, code);
    cmd = `g++ ${file} -o code.exe && code.exe`;
  } 
  else if (language === "c") {
    file = path.join(dir, "code.c");
    fs.writeFileSync(file, code);
    cmd = `gcc ${file} -o code.exe && code.exe`;
  } 
  else if (language === "java") {
    file = path.join(dir, "Main.java");
    fs.writeFileSync(file, code);
    cmd = `javac ${file} && java -cp ${dir} Main`;
  } 
  else {
    return res.json({ error: "Unsupported language" });
  }

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
      return res.json({ error: stderr || err.message });
    }
    res.json({ output: stdout });
  });
});

server.listen(5000, () => {
  console.log("Server running on 5000");
});