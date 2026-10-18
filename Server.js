// RandomCam Signaling Server (Node.js + Socket.IO)
// Run: npm init -y && npm i express socket.io
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let waitingQueue = []; // [{ socketId, userId, topic }]

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_matchmaking', ({ userId, topic }) => {
    // Check if someone else is waiting
    const partnerIdx = waitingQueue.findIndex(p => p.socketId !== socket.id);
    if (partnerIdx !== -1) {
      const partner = waitingQueue.splice(partnerIdx, 1)[0];
      const roomId = 'room_' + socket.id + '_' + partner.socketId;

      socket.join(roomId);
      io.sockets.sockets.get(partner.socketId)?.join(roomId);

      // Notify both peers
      socket.emit('matched', { roomId, peerId: partner.userId, isInitiator: true });
      io.to(partner.socketId).emit('matched', { roomId, peerId: userId, isInitiator: false });
    } else {
      waitingQueue.push({ socketId: socket.id, userId, topic });
      socket.emit('waiting');
    }
  });

  socket.on('offer', (data) => socket.to(data.roomId).emit('offer', data));
  socket.on('answer', (data) => socket.to(data.roomId).emit('answer', data));
  socket.on('ice_candidate', (data) => socket.to(data.roomId).emit('ice_candidate', data));
  socket.on('chat_message', (data) => socket.to(data.roomId).emit('chat_message', data));
  socket.on('reaction', (data) => socket.to(data.roomId).emit('reaction', data));

  const cleanup = () => {
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.to(room).emit('partner_disconnected', { reason: 'Partner left' });
    }
  };

  socket.on('skip', (data) => {
    socket.to(data.roomId).emit('partner_disconnected', { reason: 'Skipped' });
    socket.leave(data.roomId);
  });

  socket.on('disconnect', cleanup);
});

server.listen(3000, () => console.log('RandomCam Signaling on :3000'));
