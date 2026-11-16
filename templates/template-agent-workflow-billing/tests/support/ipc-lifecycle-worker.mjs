process.on('SIGTERM', () => setTimeout(() => process.exit(0), 50));
process.on('message', message => {
  if (message.type === 'exit') process.exit(2);
  else process.send({ type: 'echoed', round: message.round, value: message.value });
});
process.send({ type: 'ready', pid: process.pid });
