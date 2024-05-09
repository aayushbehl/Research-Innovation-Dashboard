import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from "@mui/material/Button";
import Grid from '@mui/material/Grid';
import {useState, useEffect} from 'react';
import './ResearcherProfile.css'
import { Typography } from '@mui/material';
import Pagination from "@mui/material/Pagination";

export default function GraphInformation(props){
    return (
        <Box>
          <Box sx={{ ml: "2%", mr: "2%", mb: "0.5%"}} id="header_text">
            Collaborators
          </Box>
          <Box sx={{ ml: "2%", mr: "2%", mb:"0.25%"}}>
            <Typography>View a graph of this researcher's connections</Typography>
          </Box>
          <Box textAlign="center" sx={{ ml: "2%", mr: "2%", mb:"2%"}}>
              <Button onClick={props.onClickFunction} sx={{
                m: 1,
                border: "2px solid Black",
                color: "black",
                backgroundColor: "white",
              }}>
                View Collaborators
              </Button>
          </Box>
        </Box>
      );
    }