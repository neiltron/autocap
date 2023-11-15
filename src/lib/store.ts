import { writable, get } from 'svelte/store';
import { pipeline } from '@xenova/transformers';

export type wordChunk = {
    text: string,
    timestamp: [number, number]
};

type loaderFiles = string[];

type progressData = {
    status: string,
    name: string,
    file: string,
    progress: number,
    loaded: number,
    total: number
};

export const audioFile = writable<Blob | MediaSource | null>(null);
export const captionFile = writable<Blob>("" as unknown as Blob);
export const loaderFiles = writable<string[]>([])
export const phrases = writable<wordChunk[]>([])

// not actually using this until we implement workers
// keeping code as reference
const handleProgress: boolean = false;

export async function transcribeAudio() {
    const file: Blob | MediaSource | null = get(audioFile);
    if (file == null) return;

    const url = URL.createObjectURL(file);
    const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        revision: 'output_attentions',
        progress_callback: (progressData: progressData) => {
            if (!handleProgress) return;

            const files: string[] = get(loaderFiles);
            if (files.indexOf(progressData.file) === -1) {
                loaderFiles.set([...files, progressData.file]);
            }

            if (progressData.status === 'progress' && progressData.progress === 100) {
                loaderFiles.set(files.filter(file => file !== progressData.file));
            }
        }
    });

    const transcription = await transcriber(url, {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5
    });

    phrases.set(await groupIntoPhrases(transcription.chunks));
    getClosedCaptionBlob();

    return url;
}

async function groupIntoPhrases(wordChunks: wordChunk[], minWords = 5, maxWords = 10): Promise<wordChunk[]> {
    let currentPhrase = "";
    let phraseStart = 0;
    let phraseEnd = 0;
    let wordCount = 0;
    let previousEndTime = 0;
    const phrases: wordChunk[] = [];

    wordChunks.forEach((chunk, index) => {
        // Adjust start time if it overlaps with previous end time
        if (wordCount === 0) {
            phraseStart = Math.max(chunk.timestamp[0], previousEndTime);
        }

        currentPhrase += chunk.text + " ";
        wordCount += 1;

        // Check if the phrase has reached the minimum length, max length or is the last word
        if (wordCount >= minWords || index === wordChunks.length - 1 || wordCount === maxWords) {
            phraseEnd = chunk.timestamp[1];

            // Adjust end time if it is before the start time
            if (phraseEnd < phraseStart) {
                phraseEnd = phraseStart + 0.001; // Increment by 1 millisecond
            }

            phrases.push({
                text: currentPhrase.trim(),
                timestamp: [phraseStart, phraseEnd]
            });

            // Update the previous end time and reset for next phrase
            previousEndTime = phraseEnd;
            currentPhrase = "";
            wordCount = 0;
        }
    });

    return phrases;
}

export function downloadSRT() {
    const srtContent: string = convertToSRT();
    downloadFile('captions.srt', srtContent);
}

export function downloadVTT() {
    const vttContent: string = convertToVTT();
    downloadFile('captions.vtt', vttContent);
}

export function getClosedCaptionBlob() {
    const vttContent: string = convertToVTT();
    captionFile.set(new Blob([vttContent], { type: "text/vtt" }));
}

function convertToSRT(): string {
    let srtContent = '';

    get(phrases).forEach((phrase, index) => {
        const startTime = new Date(phrase.timestamp[0] * 1000).toISOString().substr(11, 12).replace('.', ',');
        const endTime = new Date(phrase.timestamp[1] * 1000).toISOString().substr(11, 12).replace('.', ',');

        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${phrase.text}\n\n`;
    });

    return srtContent;
}

function convertToVTT() {
    let vttContent = 'WEBVTT\n\n';

    get(phrases).forEach((phrase, index) => {
        const startTime = new Date(phrase.timestamp[0] * 1000).toISOString().substr(11, 12).replace('.', '.');
        const endTime = new Date(phrase.timestamp[1] * 1000).toISOString().substr(11, 12).replace('.', '.');

        vttContent += `${index + 1}\n`;
        vttContent += `${startTime} --> ${endTime}\n`;
        vttContent += `${phrase.text}\n\n`;
    });

    return vttContent;
}

function downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}