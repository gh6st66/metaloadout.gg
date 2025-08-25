

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import Chart from 'chart.js/auto';
import { GoogleGenAI, Type } from "@google/genai";
import _ from "lodash";

const GAME_CONTEXT = {
  modes: ["Cashout", "BankIt", "PowerShift"],
  maps: ["Monaco", "Seoul", "Las Vegas", "Skyway Stadium"],
  playstyles: ["Aggressive", "Balanced", "Anchor", "Flank"],
};

const AI_PERSONAS = ["Expert Analyst", "Encouraging Coach", "Straight Shooter", "Witty Commentator"];

// --- Gemini and Catalog Logic ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CatalogSchema = {
  type: Type.OBJECT,
  properties: {
    weapons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          class: { type: Type.STRING, nullable: true },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["id", "tags", "notes"]
      }
    },
    gadgets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["id", "tags", "notes"]
      }
    },
    specializations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          class: { type: Type.STRING, nullable: true },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["id", "tags", "notes"]
      }
    },
    meta: {
      type: Type.OBJECT,
      properties: {
        synergy: { type: Type.ARRAY, items: { type: Type.STRING } },
        counters: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    }
  },
  required: ["weapons", "gadgets", "specializations"]
};

const EXTRACT_PROMPT = `Task: Extract ONLY gameplay facts from the transcript. Ignore jokes, insults, filler.
Normalize names: KS‑23→"KS23", Anti‑Gravity Cube→"AntiGravityCube", Healing Emitter→"HealingEmitter", Double Barrel→"DoubleBarrel", Dematerializer→"Dematerializer", Charge and Slam→"ChargeAndSlam".
Tag set is in tags_registry.json. Use only allowed tags.
Write neutral notes sourced from the transcript. No opinions.
Output JSON with keys: weapons[], gadgets[], specializations[], meta{synergy[],counters[]}.
Max note length 240 chars. Lowercase tags.`;

async function extractCatalogFromTranscript(transcript: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: EXTRACT_PROMPT + "\n\nTranscript:\n" + transcript,
    config: {
      responseMimeType: "application/json",
      responseSchema: CatalogSchema,
      temperature: 0.2
    }
  });
  return JSON.parse(response.text);
}

function mergeCatalog(base: any, delta: any) {
  const { extractedData, provenanceEntry } = delta;
  const mergeList = (a: any[], b: any[], key = "id") =>
    _(a).concat(b).groupBy(key).map(v => ({
      ...v[0],
      ...v.slice(1).reduce((acc, cur) => ({
        ...acc,
        tags: _.uniq([...(acc.tags||[]), ...(cur.tags||[])]),
        notes: _.uniq([...(acc.notes||[]), ...(cur.notes||[])])
      }), v[0])
    })).value();

  const [major, minor, patch] = base.version.split('.').map(Number);
  const newVersion = `${major}.${minor}.${patch + 1}`;

  return {
    ...base,
    version: newVersion,
    updated_at: new Date().toISOString(),
    weapons: mergeList(base.weapons||[], extractedData.weapons||[]),
    gadgets: mergeList(base.gadgets||[], extractedData.gadgets||[]),
    specializations: mergeList(base.specializations||[], extractedData.specializations||[]),
    meta: {
      ...base.meta,
      synergy: _.uniq([...(base.meta?.synergy||[]), ...(extractedData.meta?.synergy||[])]),
      counters: _.uniq([...(base.meta?.counters||[]), ...(extractedData.meta?.counters||[])])
    },
    _provenance: [...(base._provenance || []), provenanceEntry]
  };
}


// --- Analysis Engine ---
type Scores = { Damage:number; Survivability:number; Mobility:number; Utility:number; ObjectivePressure:number; Denial:number; };
const MODE_WEIGHTS: Record<string, Partial<Scores>> = {
  Cashout:       { Damage:.18, Survivability:.20, Mobility:.12, Utility:.18, ObjectivePressure:.22, Denial:.10 },
  BankIt:        { Damage:.22, Survivability:.14, Mobility:.20, Utility:.14, ObjectivePressure:.18, Denial:.12 },
  PowerShift:    { Damage:.16, Survivability:.18, Mobility:.16, Utility:.16, ObjectivePressure:.18, Denial:.16 }
};

async function generateAiCommentary(loadout, context, localAnalysis, persona) {
    let systemInstruction = "You are an expert analyst for the game THE FINALS.";
    switch (persona) {
        case "Encouraging Coach":
            systemInstruction = "You are an encouraging coach for the game THE FINALS. Focus on potential and positive reinforcement, while still giving useful advice.";
            break;
        case "Straight Shooter":
            systemInstruction = "You