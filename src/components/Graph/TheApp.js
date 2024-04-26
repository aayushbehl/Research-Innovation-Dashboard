import React, { useState, useEffect } from "react";
import '../../index.css';
import Grid from '@mui/material/Grid';
import {ResearcherGraph} from './ResearcherGraph/ResearcherGraph';
import Navbar from "./Navbar/navbar";
import {SearchBar} from "./Searchbar/searchbar"
import Tutorial from "./Tutorial/Tutorial";
import { useParams } from 'react-router-dom';

import Amplify from "@aws-amplify/core";
import { Auth } from "@aws-amplify/auth";
import awsmobile from "../../aws-exports";
import { API } from "aws-amplify";

import {
  getResearchers,
  getEdges,
  getAllFaculty,
} from "../../graphql/queries";

Amplify.configure(awsmobile);
Auth.configure(awsmobile);


export default function TheApp(props) {
  const { scopusId } = useParams();

  const [researcherNodes, setResearcherNodes] = useState(null);
  const [graphEdges, setGraphEdges] = useState(null);
  const [autoCompleteOptions, setAutoCompleteOptions] = useState([]);
  const [allFaculties, setAllFaculties] = useState([]);
  const [currentlyAppliedFaculties, setCurrentlyAppliedFaculties] = useState([]);
  const [currentlyAppliedKeywordFilter, setCurrentlyAppliedKeywordFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [chosenFaculties, setChosenFaculties] = useState([]);
  const [openFacultyFiltersDialog, setOpenFacultyFiltersDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [run, setRun] = useState(false);
  const [graphProgress, setGraphProgress ] = useState(10)

  //On page load get the faculties
  useEffect(() => {
    getTheFaculties();
  }, [])

  //On page load and every time filters are changed re-make the graph
  useEffect(() => {
    changeGraph();
  }, [currentlyAppliedFaculties, currentlyAppliedKeywordFilter])

  const filterNodesAndEdges = async (nodes, edges, keyword, facultiesToFilterOn) => {
    const filterNodes = await API.graphql({
      query: getResearchers,
      variables: {"facultiesToFilterOn": facultiesToFilterOn, "keyword": keyword},
    });
    const keys = filterNodes.data.getResearchers.map((node) => node.key);
    nodes = nodes.filter((node) => keys.includes(node.key));
    edges = edges.filter((edge) => keys.includes(edge.source) && keys.includes(edge.target))
    return [nodes, edges]
  }

  const getGraph = async () => {
    try {
      var time = Date.now();
      const session = await Auth.currentSession()
      const region = session.getIdToken().payload.iss.split('.')[1];
      const jwt = session.getAccessToken().getJwtToken();
      const clientId = session.getAccessToken().payload.client_id
      
      let [researchers, edgesResult] = await Promise.all([
        (await fetch(`${process.env.REACT_APP_CLOUDFRONT_URL}nodes.json`, {
          mode: 'cors',
          headers: {
            "clientid": clientId,
            "Authorization": jwt,
            "region": region
          }
        })).json(),
        (await fetch(`${process.env.REACT_APP_CLOUDFRONT_URL}edges.json`, {
          headers: {
            "clientid": clientId,
            "Authorization": jwt,
            "region": region
          }
        })).json()
      ]);

      if(currentlyAppliedFaculties.length > 0 || keywordFilter.toLocaleLowerCase().length > 0)
        [researchers, edgesResult] = await filterNodesAndEdges(researchers, edgesResult, keywordFilter.toLocaleLowerCase(), currentlyAppliedFaculties);

      setResearcherNodes(researchers);
      setGraphEdges(edgesResult);
      setGraphProgress(20);
      setAutoCompleteOptions(Object.values(researchers).map(formatOptions));
      console.log(`Took ${Date.now() - time} ms`);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const formatOptions = (entry) => {
    let retval = entry.attributes
    retval.id = entry.key
    return retval
  }

  const getTheFaculties = async () => {
    const getFaculties = await API.graphql({
      query: getAllFaculty,
    });
    setAllFaculties(getFaculties.data.getAllFaculty)
  }

  const changeGraph = () => {
    setGraphEdges(null);
    setResearcherNodes(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setGraphProgress(10)
    getGraph();
    setSelectedNode(scopusId);
  }

  function startTutorial() {
    setRun(true);
  }

  return (
    <Grid container spacing={2}>
      <Tutorial selectedNode={selectedNode} setSelectedNode={setSelectedNode}
                selectedEdge={selectedEdge} setSelectedEdge={setSelectedEdge}
                openFacultyFiltersDialog={openFacultyFiltersDialog}
                run={run} setRun={setRun}/>
      <Grid item xs={12}>
        <Navbar startTutorial={startTutorial}/>
      </Grid>
      <Grid id="search-bar-main" item xs={12}>
        <SearchBar text="Search Graph" size="100vh" setOpenFacultyFiltersDialog={setOpenFacultyFiltersDialog} 
        autoCompleteOptions={autoCompleteOptions} searchQuery={searchQuery} setSearchQuery={setSearchQuery}></SearchBar>
      </Grid>
      <Grid item xs={12}>
        <ResearcherGraph researcherNodes={researcherNodes}  
        graphEdges={graphEdges} facultyOptions={allFaculties}
        currentlyAppliedFaculties={currentlyAppliedFaculties} setCurrentlyAppliedFaculties={setCurrentlyAppliedFaculties}
        selectedFaculties={chosenFaculties} setSelectedFaculties={setChosenFaculties}
        changeGraph={changeGraph} openFacultyFiltersDialog={openFacultyFiltersDialog} setOpenFacultyFiltersDialog={setOpenFacultyFiltersDialog}
        keywordFilter={keywordFilter} setKeywordFilter={setKeywordFilter}
        currentlyAppliedKeywordFilter={currentlyAppliedKeywordFilter} setCurrentlyAppliedKeywordFilter={setCurrentlyAppliedKeywordFilter}
        selectedNode={selectedNode} setSelectedNode={setSelectedNode}
        selectedEdge={selectedEdge} setSelectedEdge={setSelectedEdge}
        graphProgress={graphProgress} setGraphProgress={setGraphProgress}
        />
      </Grid>
    </Grid>
  )
}