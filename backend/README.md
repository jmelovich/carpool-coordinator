# Backend

This folder is where the backend portion of this project will be relegated.

The backend server will be built using Flask, a python library. To simplify the set up of this, I created a conda environment with the necessary dependencies. Its important to use this environment. 

## Environment Setup

To set up the conda environment, make sure Anaconda/Miniconda is installed, then navigate to this backend/ folder in the terminal and run: 

``conda env create -f environment.yml``

This environment.yml file will be updated as needed, to update your environment navigate to the backend/ folder and run:

``conda env update --name carpool_coordinator --file environment.yml --prune``
