import React from "react";
import { Dialog, Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TheApp from "../Graph/TheApp";

const CollaborationPopup = (props) => {
    return (
        <Dialog
         open={true}
         PaperProps={{ sx: { minWidth: "90%", maxHeight: "90%" } }}>
            <IconButton sx={{ alignSelf: "flex-end" }} onClick={props.handleClose}>
                <CloseIcon />
            </IconButton>
            <TheApp scopusId={props.scopusId}></TheApp>
        </Dialog>
    )
}

export default CollaborationPopup;