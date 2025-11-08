import { Artifact } from '../types/artifact.types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface Props {
  artifact: Artifact;
}

export default function ArtifactRenderer({ artifact }: Props) {
  switch (artifact.type) {
    case 'html':
    case 'react':
      return (
        <iframe
          srcDoc={artifact.code || String(artifact.content)}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0 bg-white"
        />
      );

    case 'chart':
      const chartData = artifact.content as any;
      return (
        <LineChart width={600} height={400} data={chartData.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chartData.xAxis} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={chartData.yAxis} stroke="#8884d8" />
        </LineChart>
      );

    case 'markdown':
      return (
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: artifact.content as string }}
        />
      );

    default:
      return <div>Unsupported artifact type: {artifact.type}</div>;
  }
}
