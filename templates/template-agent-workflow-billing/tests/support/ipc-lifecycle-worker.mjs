process.on('SIGTERM', () => setTimeout(() => process.exit(0), 50));
process.on('message', message => {
  if (message.type === 'flood')
    process.stdout.write(Buffer.alloc(4 * 1024 * 1024, 120), () =>
      process.send({ type: 'flushed', round: message.round }),
    );
  else if (message.type === 'exit') process.exit(2);
  else process.send({ type: 'echoed', round: message.round, value: message.value });
});
process.send({ type: 'ready', pid: process.pid });
