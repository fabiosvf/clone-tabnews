import bcryptjs from "bcrypt";

async function hash(password) {
  const rounds = getNumberOfRounds();
  const pepperedPassword = getPepperedPassword(password);
  return await bcryptjs.hash(pepperedPassword, rounds);
}

function getNumberOfRounds() {
  return process.env.NODE_ENV == "production" ? 14 : 1;
}

function getPepperedPassword(password) {
  const pepper = process.env.PEPPER || "";
  return password + pepper;
}

async function compare(providedPassword, storedPassword) {
  const pepperedPassword = getPepperedPassword(providedPassword);
  return await bcryptjs.compare(pepperedPassword, storedPassword);
}

const password = {
  hash,
  compare,
};

export default password;
