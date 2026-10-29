import express from 'express';
import path from 'path';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

// Fallback to .env.example if `.env` doesn't have SUPABASE_URL but .env.example does
if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project-id')) {
  try {
    const examplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(examplePath)) {
      const envConfig = dotenv.parse(fs.readFileSync(examplePath));
      for (const k in envConfig) {
        if (!process.env[k] || process.env[k].includes('your-project-id') || process.env[k].includes('your-anon-api-key')) {
          process.env[k] = envConfig[k];
        }
      }
    }
  } catch (err) {
    console.error('Failed to read .env.example:', err);
  }
}

let supabaseClient: any = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

let aiClient: GoogleGenAI | null = null;

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error('GEMINI_API_KEY environment variable is required and must be a valid Google Gemini API Key. Please configure it in your .env file.');
  }
  if (aiClient) return aiClient;
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser limit
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Gemini Translation & Sentence Splitting endpoint
  app.post('/api/translate', async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: '학습할 한국어 또는 영어 문장을 입력해 주세요.' });
    }

    try {
      const ai = getGemini();
      const prompt = `Analyze the input text to determine if it is primarily in Korean or primarily in English.

Case 1: The input text is primarily in English.
- Split the text into logical sentences.
- For each sentence, set the 'english' field to the EXACT English sentence from the input text. Do not rewrite, modify, or translate the English sentence. It must match the original input sentence exactly.
- Translate it into natural, accurate Korean and set it as the 'korean' field.
- Provide a detailed Korean explanation of the English sentence's structure, vocabulary, and grammar tips in the 'explanation' field.

Case 2: The input text is primarily in Korean.
- Split the text into logical sentences.
- For each sentence, set the 'korean' field to the Korean sentence from the input text.
- Translate it into natural, elegant, sophisticated English equivalent to a Duolingo English Test (DET) score of 120 (C1 advanced level) and set it as the 'english' field.
- Provide a detailed Korean explanation explaining why it is translated this way (including grammar tips, sentence structure, or advanced vocabulary choices) in the 'explanation' field.

Input text:
"${text.trim()}"

Return the output strictly as a JSON array of objects, where each object has 'korean', 'english', and 'explanation' keys.
Example output format:
[
  {
    "korean": "한국어 문장 또는 해석",
    "english": "English sentence.",
    "explanation": "이 문장의 어순, 문법, 어휘 사용에 대한 상세한 한국어 설명입니다."
  }
]
Do not return any markdown wraps like \`\`\`json outside of the JSON payload. Just return the raw JSON.`;

      let responseText = '';
      const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
      let lastError = null;

      for (const modelName of modelsToTry) {
        let attempts = 0;
        const maxAttempts = 3;
        let delay = 500;
        let success = false;

        while (attempts < maxAttempts && !success) {
          try {
            attempts++;
            console.log(`Attempting translation with model: ${modelName} (Attempt ${attempts}/${maxAttempts})`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      korean: { type: Type.STRING },
                      english: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ["korean", "english", "explanation"],
                  },
                },
              }
            });

            if (response.text) {
              responseText = response.text;
              success = true;
              break;
            }
          } catch (modelErr: any) {
            console.error(`Model ${modelName} attempt ${attempts} failed:`, modelErr);
            lastError = modelErr;

            const status = modelErr?.status || modelErr?.statusCode || (modelErr?.error && modelErr?.error?.code);
            const message = String(modelErr?.message || modelErr?.stack || '');
            
            // If it is a transient error (503 Service Unavailable, 429 Rate Limit), retry with backoff.
            if (
              attempts < maxAttempts && 
              (status === 503 || status === 429 || status === 500 || 
               message.includes('503') || message.includes('429') || message.includes('500') ||
               message.includes('UNAVAILABLE') || message.includes('RESOURCE_EXHAUSTED') || message.includes('high demand'))
            ) {
              console.log(`Transient error detected. Waiting ${delay}ms before retrying ${modelName}...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            } else {
              // Non-retryable error or ran out of attempts for this model.
              break;
            }
          }
        }

        if (success) {
          break;
        }
      }

      if (!responseText) {
        throw lastError || new Error('Failed to get a response from any Gemini model');
      }

      const parsed = JSON.parse(responseText.trim());
      return res.json({ success: true, sentences: parsed });
    } catch (err: any) {
      console.error('Gemini translation error:', err);
      const errorStr = String(err.stack || err.message || JSON.stringify(err));
      if (
        errorStr.includes('API key not valid') || 
        errorStr.includes('API_KEY_INVALID') || 
        errorStr.includes('MY_GEMINI_API_KEY') ||
        errorStr.includes('is required and must be a valid Google Gemini API Key')
      ) {
        return res.status(500).json({ 
          success: false, 
          message: '구글 제미나이(Gemini) API 키가 유효하지 않거나 설정되지 않았습니다. 로컬에서 구동 중이라면 .env 파일의 GEMINI_API_KEY 항목에 발급받은 올바른 API 키를 입력해 주세요.' 
        });
      }
      return res.status(500).json({ success: false, message: 'AI 번역 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  });

  // Supabase Config Status endpoint
  app.get('/api/supabase/status', (req, res) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return res.json({ configured: false });
    }
    return res.json({ configured: true, url });
  });

  // Supabase Save (Sync/Upload) endpoint
  app.post('/api/supabase/save', async (req, res) => {
    const client = getSupabase();
    if (!client) {
      return res.status(400).json({ 
        success: false, 
        error: 'SUPABASE_NOT_CONFIGURED',
        message: 'Supabase URL or Anon key is missing in server environment variables.' 
      });
    }

    const { words, listId, listName } = req.body;
    if (!Array.isArray(words)) {
      return res.status(400).json({ success: false, message: 'Invalid words payload' });
    }

    const targetListId = String(listId || 'default-list-id');
    const targetListName = String(listName || '기본 단어장');

    try {
      // First, attempt to delete only the words for the specific list_id to avoid overwriting other lists
      const { error: deleteError } = await client
        .from('vocamaster_words')
        .delete()
        .eq('list_id', targetListId);

      if (deleteError) {
        // If the delete fails because of missing columns, return a helpful error so they can add columns.
        if (deleteError.code === '42703' || (deleteError.message && deleteError.message.includes('list_id'))) {
          return res.status(200).json({
            success: false,
            error: 'MISSING_LIST_COLUMNS',
            message: '단어장 리스트별 개별 데이터베이스 저장을 위해 Supabase 테이블에 list_id와 list_name 컬럼이 필요합니다.',
            suggestion: 'Supabase 대시보드의 SQL Editor에서 다음 SQL 쿼리를 실행하여 테이블 컬럼을 추가한 후 다시 시도해 주세요:\n\nALTER TABLE vocamaster_words ADD COLUMN list_id TEXT DEFAULT \'default-list-id\';\nALTER TABLE vocamaster_words ADD COLUMN list_name TEXT DEFAULT \'기본 단어장\';'
          });
        }
        console.error('Supabase delete error:', deleteError);
        return res.status(500).json({ 
          success: false, 
          error: deleteError.code, 
          message: deleteError.message,
          suggestion: 'Ensure the table "vocamaster_words" is created in your Supabase database.'
        });
      }

      // Map words with list_id and list_name properties
      const mapped = words.map(w => ({
        id: String(w.id),
        word: String(w.word),
        meaning: String(w.meaning || ''),
        sentence: String(w.sentence || ''),
        sentence_translation: String(w.sentence_translation || ''),
        attempts: Number(w.attempts || 0),
        correctCount: Number(w.correctCount || 0),
        mastered: Boolean(w.mastered),
        list_id: targetListId,
        list_name: targetListName
      }));

      if (mapped.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < mapped.length; i += chunkSize) {
          const chunk = mapped.slice(i, i + chunkSize);
          const { error: insertError } = await client
            .from('vocamaster_words')
            .insert(chunk);

          if (insertError) {
            console.error('Supabase insert error:', insertError);
            if (insertError.code === '42703') {
              return res.status(200).json({
                success: false,
                error: 'MISSING_LIST_COLUMNS',
                message: '단어장 리스트별 개별 데이터베이스 저장을 위해 Supabase 테이블에 list_id와 list_name 컬럼이 필요합니다.',
                suggestion: 'Supabase 대시보드의 SQL Editor에서 다음 SQL 쿼리를 실행하여 테이블 컬럼을 추가한 후 다시 시도해 주세요:\n\nALTER TABLE vocamaster_words ADD COLUMN list_id TEXT DEFAULT \'default-list-id\';\nALTER TABLE vocamaster_words ADD COLUMN list_name TEXT DEFAULT \'기본 단어장\';'
              });
            }
            return res.status(500).json({ success: false, error: insertError.code, message: insertError.message });
          }
        }
      }

      return res.json({ success: true, count: mapped.length });
    } catch (err: any) {
      console.error('Server error saving to Supabase:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Supabase Load (Sync/Download) endpoint
  app.get('/api/supabase/load', async (req, res) => {
    const client = getSupabase();
    if (!client) {
      return res.status(400).json({ 
        success: false, 
        error: 'SUPABASE_NOT_CONFIGURED',
        message: 'Supabase URL or Anon key is missing in server environment variables.' 
      });
    }

    try {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      const targetListId = req.query.list_id ? String(req.query.list_id) : undefined;

      while (hasMore) {
        let queryBuilder = client
          .from('vocamaster_words')
          .select('*')
          .range(from, from + step - 1);

        if (targetListId) {
          queryBuilder = queryBuilder.eq('list_id', targetListId);
        }

        const { data, error } = await queryBuilder;

        if (error) {
          console.error('Supabase fetch error:', error);
          if (error.code === '42703' || (error.message && error.message.includes('list_id'))) {
            return res.status(200).json({
              success: false,
              error: 'MISSING_LIST_COLUMNS',
              message: '단어장 리스트별 개별 데이터베이스 저장을 위해 Supabase 테이블에 list_id와 list_name 컬럼이 필요합니다.',
              suggestion: 'Supabase 대시보드의 SQL Editor에서 다음 SQL 쿼리를 실행하여 테이블 컬럼을 추가한 후 다시 시도해 주세요:\n\nALTER TABLE vocamaster_words ADD COLUMN list_id TEXT DEFAULT \'default-list-id\';\nALTER TABLE vocamaster_words ADD COLUMN list_name TEXT DEFAULT \'기본 단어장\';'
            });
          }
          return res.status(500).json({ 
            success: false, 
            error: error.code, 
            message: error.message,
            suggestion: 'Ensure the table "vocamaster_words" is created in your Supabase database.'
          });
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          from += step;
          if (data.length < step) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Reconstruct and group lists by list_id and list_name
      const grouped: { [key: string]: { name: string; words: any[] } } = {};
      
      allData.forEach((row: any) => {
        const lid = row.list_id || 'default-list-id';
        const lname = row.list_name || '기본 단어장';
        if (!grouped[lid]) {
          grouped[lid] = { name: lname, words: [] };
        }
        grouped[lid].words.push({
          id: row.id,
          word: row.word,
          meaning: row.meaning,
          sentence: row.sentence,
          sentence_translation: row.sentence_translation,
          attempts: Number(row.attempts || 0),
          correctCount: Number(row.correctCount || 0),
          mastered: Boolean(row.mastered)
        });
      });

      const parsedLists = Object.entries(grouped).map(([id, val]) => ({
        id,
        name: val.name,
        words: val.words
      }));

      const mappedFlatWords = allData.map((row: any) => ({
        id: row.id,
        word: row.word,
        meaning: row.meaning,
        sentence: row.sentence,
        sentence_translation: row.sentence_translation,
        attempts: Number(row.attempts || 0),
        correctCount: Number(row.correctCount || 0),
        mastered: Boolean(row.mastered)
      }));

      return res.json({ 
        success: true, 
        lists: parsedLists,
        words: mappedFlatWords 
      });
    } catch (err: any) {
      console.error('Server error loading from Supabase:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`  ➜  Network: http://${iface.address}:${PORT}/`);
        }
      }
    }
    console.log();
  });
}

startServer();
