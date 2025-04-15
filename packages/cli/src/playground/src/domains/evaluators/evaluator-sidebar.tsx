import { useState } from 'react';
import { GetEvaluatorResponse } from '@mastra/client-js';
import { client } from '@/lib/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function EvaluatorSidebar({ evaluator }: { evaluator: GetEvaluatorResponse }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExecute = async () => {
    try {
      setLoading(true);
      setError('');
      setResult(null);

      // Get the evaluator ID by fetching all evaluators and looking up by name
      const evaluatorsResponse = await client.getEvaluators();
      const evaluatorId = Object.keys(evaluatorsResponse).find(id => evaluatorsResponse[id].name === evaluator.name);

      if (!evaluatorId) {
        throw new Error('Could not determine evaluator ID');
      }

      if (!input || !output) {
        throw new Error('Input and output are required');
      }

      const evaluationResult = await client.executeEvaluator({
        evaluatorId,
        input,
        output,
        options: {},
      });

      setResult(evaluationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Evaluation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="">
        <div className="mb-4">
          <Label htmlFor="input-text" className="text-xs text-mastra-el-3">
            Input Text
          </Label>
          <Textarea
            id="input-text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter the input text to evaluate..."
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="output-text" className="text-xs text-mastra-el-3">
            Output Text
          </Label>
          <Textarea
            id="output-text"
            value={output}
            onChange={e => setOutput(e.target.value)}
            placeholder="Enter the output text to evaluate..."
          />
        </div>
      </div>

      <Button
        onClick={handleExecute}
        size="sm"
        variant="secondary"
        disabled={loading || !input.trim() || !output.trim()}
      >
        {loading ? 'Evaluating...' : 'Execute Evaluation'}
      </Button>

      {result && (
        <div className="flex flex-col gap-2 mt-10">
          <h3 className="mb-4 text-sm text-mastra-el-6">Results</h3>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-mastra-el-3">Score</p>
            <Badge className="h-8 w-[154px]" variant="outline">
              {result.score}
            </Badge>
          </div>
          {result.info.reason && Object.keys(result.info.reason).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-mastra-el-3">Reason</p>
              <Card className="text-sm">
                <CardContent className="p-4">
                  <ScrollArea className="h-[200px]">
                    <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result.info.reason, null, 2)}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
          {result.info.details && Object.keys(result.info.details).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-mastra-el-3">Details</p>
              <Card className="text-sm">
                <CardContent className="p-4">
                  <ScrollArea className="h-[200px]">
                    <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result.info.details, null, 2)}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
