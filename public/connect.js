const oracledb = require('oracledb');

async function connectDB() {
    try {
        const connection = await oracledb.getConnection({
            user: "your_username",
            password: "your_password",
            connectionString: "localhost/XEPDB1"
        });
        console.log("Connected to Oracle DB!");
        connection.close();
    } catch (err) {
        console.error(err);
    }
}
connectDB();
