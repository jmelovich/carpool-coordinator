# Backend

This folder is where the backend portion of this project will be relegated.

The backend server will be built using Flask, a python library. To simplify the set up of this, I created a conda environment with the necessary dependencies. Its important to use this environment. The database will be handled with SQLite.

## Environment Setup

To set up the conda environment, make sure Anaconda/Miniconda is installed, then navigate to this backend/ folder in the Anaconda prompt and run:

`conda env create -f environment.yml`

`conda activate carpool_coordinator`

This environment.yml file will be updated as needed, to update your environment navigate to the backend/ folder and run:

`conda env update --name carpool_coordinator --file environment.yml --prune`


## Using The Backend

Once the conda environment is activated, run the ```run.py``` script to start the local server. `python run.py` works for this purpose.

For the sake of testing the backend, I have provided some CURL commands that demonstrate how to use it and what it expects. Try running these using Git Bash.

Health Check:

```
curl -X GET http://localhost:5000/ -H 'Content-Type: application/json'

--- SHOULD RETURN ---
{
  "message": "Carpool Coordinator API is running",
  "status": "healthy"
}
```

Register A New User:
```
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username": "newuser", "email": "newuser@example.com", "password": "password123"}'

--- SHOULD RETURN ---
{
  "access_token": "<ACCESS-TOKEN-WOULD-BE-HERE>",
  "message": "User registered successfully",
  "user": {
    "email": "newuser@example.com",
    "id": 1,
    "username": "newuser"
  }
}
```

Login As User:
```
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "newuser", "password": "password123"}'

--- SHOULD RETURN ---
{
  "access_token": "<ACCESS-TOKEN-WOULD-BE-HERE>",
  "user": {
    "id": 1,
    "username": "newuser"
  }
}
```

Get The Current User's Information:
```
curl -X GET http://localhost:5000/api/users/me \
  -H 'Authorization: Bearer <YOUR_ACCESS_TOKEN>' \
  -H 'Content-Type: application/json'

--- SHOULD RETURN ---
{
  "user": {
    "email": "newuser@example.com",
    "id": 1,
    "username": "newuser"
  }
}
```

Get A User's Public Information:
```
curl -X GET http://localhost:5000/api/users/<USER_ID> \
  -H 'Authorization: Bearer <YOUR_ACCESS_TOKEN>' \
  -H 'Content-Type: application/json'

--- SHOULD RETURN ---
{
  "user": {
    "id": 1,
    "username": "newuser"
  }
}
```

## Viewing The Database

The database is stored as 'carpool.db' in the 'backend/app' folder (as a SQLite Database). If need be, you can use a tool to view this database directly. I (Luke) use a VSCode extension called [`SQLite Viewer`](https://marketplace.visualstudio.com/items?itemName=qwtel.sqlite-viewer), which lets me view .db files within VSCode- but other options work too. Note this is only useful for development/debugging purposes, and any information that needs to be gotten from the database by the site needs to be implemented via the backend API.

### Debugging using SQLite
To use SQL commands to manipulate your local 'carpool.db', open Anaconda Prompt and head to the directory where 'carpool.db' is (/backend /app ). Then type `sqlite3`, and you will have launched SQLite! (Works regardless if you're in the environment on conda). Once in SQLite and the database, SQL statements work as normal (don't forget to end with a `;`). SQLite is also useful to manipulate rows, columns, and cells as the SQLite Viewer extension doesn't allow it while using it for free.

To quit SQlite type `.quit`

To open the database for manipulation type `.open carpool.db`

To open documentation on your CLI type `.help`

For further commands and examples on how to use SQLite/SQL see [`here`](https://www.sqlitetutorial.net/sqlite-commands/)

Personal (Ed's) favorite SQL statements:

Deletes a row where id is 1
```
DELETE FROM users 
WHERE id = 1;
```

Gets all the data from the table of users (You may also just refresh carpool.db to see the latest changes using SQLite Viewer)
```
SELECT * FROM users;
```

Sets id to 1 where username is "newuser"
```
UPDATE users
set id = 1
WHERE username = "newuser";
```