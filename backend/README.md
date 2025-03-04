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

Once the conda environment is activated, run the ```run.py``` script to start the local server.

For the sake of testing the backend, I have provided some CURL commands that demonstrate how to use it and what it expects.

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