#!/bin/bash
AMPLIFY_APP_ID=$(amplify appId)
aws ssm put-parameter --name "/amplify/appId" --value "$AMPLIFY_APP_ID" --type "String" --overwrite