const { app, start } = require('./src/app');

const PORT = process.env.PORT || 5000;

start()
	.then(() => {
		app.listen(PORT, () => {
			console.log(`Server listening on port ${PORT}`);
		});
	})
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
