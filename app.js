const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    console.log("Database connected successfully ");

    app.listen(3000, () => {
      console.log("http://localhost:3000/");
    });
  } catch (e) {
    console.log(`Db error ${e.message}`);
  }
};
initializeDbAndServer();

// user login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectQueries = `
         select * from user where username = '${username}'
  `;
  const dbUser = await db.get(selectQueries);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const matchedPassword = await bcrypt.compare(password, dbUser.password);
    if (matchedPassword === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "my_Token");
      response.send({ jwtToken });
    }
  }
});

// Mid Function

const authentication = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_Token", (error, decoded) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 2 : Get state details

app.get("/states/", authentication, async (request, response) => {
  const statesQueries = `
          select state_id as stateId,
           state_name as stateName,
          population
           from state order by state_id
        `;

  const updateQueries = await db.all(statesQueries);
  response.send(updateQueries);
});

// API 3 : Get State Details by StateId

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  console.log(stateId);
  const stateIdQueries = `
             select state_id as stateId,
           state_name as stateName,
          population
           from state
           WHERE state_id = '${stateId}'
       `;
  const updateQueries = await db.get(stateIdQueries);
  response.send(updateQueries);
});

// API 4 : Add District Details

app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const districtsQueries = `
      INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
      VALUES 
      (
          '${districtName}',
          '${stateId}',
          '${cases}',
          '${cured}',
          '${active}',
          '${deaths}'
      )
    `;
  await db.run(districtsQueries);
  response.send("District Successfully Added");
});

// API 5 : Get Details by districtId

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    console.log(districtId);
    const districtsIdQueries = `
         SELECT district_id as districtId,
         district_name as districtName,
         state_id as stateId,
         cases,
         cured,
         active,
         deaths
         FROM 
         district 
         WHERE district_id = '${districtId}'

        `;
    const updateQueries = await db.get(districtsIdQueries);
    response.send(updateQueries);

    console.log(updateQueries);
  }
);

// API 5: Delete details by districtId

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQueries = ` 
                 DELETE FROM district 
                 WHERE district_id = '${districtId}'
           `;
    const updateQueries = await db.run(deleteQueries);
    response.send("District Removed");
  }
);

// API 6 : update details by districtId

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const selectQueries = `
    UPDATE district 
    SET 
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
    WHERE 
    district_id = '${districtId}'
    `;
    await db.run(selectQueries);
    response.send("District Details Updated");
  }
);

// API 7 : Get static details on stateId

app.get("/states/:stateId/stats", authentication, async (request, response) => {
  const { stateId } = request.params;
  console.log(stateId);
  const selectQuery = `
   SELECT 
        SUM(cases) as totalCases,
        SUM(cured) as totalCured,
        SUM(active) as totalActive,
        SUM(deaths) as totalDeaths
      FROM 
        district 
      WHERE 
        state_id = '${stateId}'
  `;
  const updateUser = await db.get(selectQuery);
  response.send({
    totalCases: updateUser.totalCases,
    totalCured: updateUser.totalCured,
    totalActive: updateUser.totalActive,
    totalDeaths: updateUser.totalDeaths,
  });
});

module.exports = app;
