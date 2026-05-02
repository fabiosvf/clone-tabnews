import email from "infra/email";
import database from "infra/database";
import webserver from "infra/webserver";

const EXPIRATION_IN_MILISECONDS = 60 * 15 * 1000; // 15 minutes

async function findOneValidByToken(activationToken) {
  const token = await runSelectQuery(activationToken);
  return token;

  async function runSelectQuery(activationToken) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          user_activation_tokens
        WHERE
          id = $1 AND
          used_at IS NULL AND
          expires_at > NOW()
        LIMIT
          1
      ;`,
      values: [activationToken],
    });

    return results.rows[0];
  }
}

async function findOneByUserId(userId) {
  const newToken = await runSelectQuery(userId);
  return newToken;

  async function runSelectQuery(userId) {
    const results = await database.query({
      text: `
        SELECT
          *
        FROM
          user_activation_tokens
        WHERE
          user_id = $1
        LIMIT
          1
      ;`,
      values: [userId],
    });

    return results.rows[0];
  }
}

async function create(userId) {
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILISECONDS);

  const newToken = await runInsertQuery(userId, expiresAt);
  return newToken;

  async function runInsertQuery(userId, expiresAt) {
    const results = await database.query({
      text: `
        INSERT INTO
          user_activation_tokens (user_id, expires_at)
        VALUES
          ($1, $2)
        RETURNING
          *
      ;`,
      values: [userId, expiresAt],
    });

    return results.rows[0];
  }
}

async function sendEmailToUser(user, activationToken) {
  await email.send({
    from: "SoCodigo <contato@socodigo.com.br>",
    to: user.email,
    subject: "Ative seu cadastro no SóCodigo!",
    text: `${user.username}, clique no link abaixo para ativar seu cadastro no SóCódigo:

${webserver.origin}/cadastro/ativar/${activationToken.id}

Att,
Equipe SóCódigo`,
  });
}

const activation = {
  findOneValidByToken,
  findOneByUserId,
  create,
  sendEmailToUser,
};

export default activation;
