import json
import boto3
import psycopg2

sm_client = boto3.client('secretsmanager')

#This function gets the credentials for the databae
def getCredentials():
    credentials = {}

    response = sm_client.get_secret_value(SecretId='expertiseDashboard/credentials/dbCredentials')
    secrets = json.loads(response['SecretString'])
    credentials['username'] = secrets['username']
    credentials['password'] = secrets['password']
    credentials['host'] = secrets['host']
    credentials['db'] = secrets['dbname']
    return credentials

def lambda_handler(event, context):
    credentials = getCredentials()
    connection = psycopg2.connect(user=credentials['username'], password=credentials['password'], host=credentials['host'], database=credentials['db'])
    cursor = connection.cursor()
    
    query = "SELECT * FROM publication_data WHERE '"+event["id1"]+"'=ANY(author_ids) AND '"+event["id2"]+"'=ANY(author_ids)" #SQL Query
    cursor.execute(query) #This runs the query
    result = cursor.fetchall() #This command gets all the data you can fetch one as well
    
    sharedPublicationsArray = []
    
    for publication in result:
        publicationObject = {
            "title": publication[1],
            "journal": publication[2],
            "yearPublished": publication[4],
            "authors": publication[6],
            "link": publication[9]
        }
        sharedPublicationsArray.append(publicationObject)
        
    return sharedPublicationsArray