// Types for the tool inputs
import { RenderDetailsInput, RenderListInput, RenderTableInput, RenderChartInput } from '../tools';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Details Component
 * Displays name, description, and attributes in a card format
 */
export const Details: React.FC<RenderDetailsInput> = ({ name, description, attributes }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h2 className="text-xl font-semibold text-gray-800">{name}</h2>
      </div>
      <div className="p-4">
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="space-y-2">
          {attributes.map((attr, index) => (
            <div key={index} className="flex py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-500 font-medium w-1/3">{attr.label}</span>
              <span className="text-gray-800 flex-1">{attr.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * List Component
 * Displays a list of items with labels and values
 */
export const List: React.FC<RenderListInput> = ({ items }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <ul className="divide-y divide-gray-200">
        {items.map((item, index) => (
          <li key={index} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">{item.label}</span>
              <span className="text-gray-600">{item.value}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Table Component
 * Displays tabular data with dynamic columns
 */
export const Table: React.FC<RenderTableInput> = ({ columns, data }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {String(row[colIndex] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Chart Component
 * Displays a bar chart using Recharts
 */
export const Chart: React.FC<RenderChartInput> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#4F46E5" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
