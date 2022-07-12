import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DoughnutChart(props) {

  let colors=[
    "#79a9bf",
    "#cfbd71",
    "#e189f7",
    "#75222",
    "#fa1257",
    "#ad5e3b",
    "#721283",
    "#bbcea0",
    "#ea2377",
    "#6b6440",
    "#ab5c19",
    "#e76a6d",
    "#fbab66",
    "#ac3594",
    "#62076",
    "#37c937",
    "#9c1348"
];


  while(colors.length<props.labels.length){
      colors.push('#'+Math.floor(Math.random()*16777215).toString(16));
  }

  console.log(colors);

  const data = {
    labels: props.labels,
    datasets: [
      {
        label: props.title,
        data: props.data,
        backgroundColor: colors
      },
    ],
  };

  return <Doughnut data={data} options={{
    responsive: true,
    maintainAspectRatio: true,
  }} />;
}
