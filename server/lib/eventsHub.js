'use strict';

/**
 * Hub SSE minimal : diffuse les inscriptions en temps reel aux onglets /admin.
 */
const clients = new Set();
let clientId = 0;

function addClient(res) {
  clientId += 1;
  const client = { id: clientId, res };
  clients.add(client);
  return client;
}

function removeClient(client) {
  clients.delete(client);
}

function send(client, event, data) {
  try {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    clients.delete(client);
  }
}

function broadcast(event, data) {
  for (const client of clients) send(client, event, data);
}

function count() {
  return clients.size;
}

module.exports = { addClient, removeClient, send, broadcast, count };
