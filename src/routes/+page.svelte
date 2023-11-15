<script lang="ts">
    import { pipeline } from '@xenova/transformers';
    import { writable } from 'svelte/store';

    type wordChunk = {
        text: string,
        timestamp: [number, number]
    };

    let videoElement: HTMLVideoElement | null = null;
    let captionElement: HTMLDivElement | null = null;
    let audioFile: File | null = null;
    let loaderFiles = writable<any[]>([])

    async function transcribeAudio() {
        if (!audioFile) return;

        let url = URL.createObjectURL(audioFile);
        let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
            revision: 'output_attentions',
            progress_callback: (progressData: any) => {
                console.log(progressData)
                if ($loaderFiles.indexOf(progressData.file) === -1) {
                    $loaderFiles = [...$loaderFiles, progressData.file];
                }

                if (progressData.status === 'progress' && progressData.progress === 100) {
                    $loaderFiles = $loaderFiles.filter(file => file !== progressData.file);
                }
            }
        });

        let output = await transcriber(url, {
            return_timestamps: 'word',
            chunk_length_s: 30,
            stride_length_s: 5
        });
        const phrases = await groupIntoPhrases(output.chunks);

        videoElement!.src = url;
        videoElement?.addEventListener('timeupdate', () => {
            const currentTime = videoElement!.currentTime;
            const currentPhrase = phrases.find(phrase => phrase.timestamp[0] <= currentTime && phrase.timestamp[1] >= currentTime);

            if (currentPhrase) {
                captionElement!.innerText = currentPhrase.text;
            }
        });
    }

    async function groupIntoPhrases(wordChunks: wordChunk[], minWords = 5, maxWords = 10) {
        console.log(wordChunks);

        let phrases: wordChunk[] = [];
        let currentPhrase = "";
        let phraseStart = 0;
        let wordCount = 0;

        wordChunks.forEach((chunk, index) => {
            if (wordCount === 0) {
                phraseStart = chunk.timestamp[0]; // Start of the new phrase
            }

            currentPhrase += chunk.text + " ";
            wordCount++;

            // Check if the phrase has reached the minimum length or is the last word
            if (wordCount >= minWords || index === wordChunks.length - 1) {
                phrases.push({
                    text: currentPhrase.trim(),
                    timestamp: [phraseStart, chunk.timestamp[1]]
                });

                // Reset for next phrase
                currentPhrase = "";
                wordCount = 0;
            }

            // If reached maxWords, force end of the current phrase
            if (wordCount === maxWords) {
                phrases.push({
                    text: currentPhrase.trim(),
                    timestamp: [phraseStart, chunk.timestamp[1]]
                });

                // Reset for next phrase
                currentPhrase = "";
                wordCount = 0;
            }
        });

        return phrases;
    }
</script>

<div class='container'>
    <header>
        <h1>🧢 <span>autocap</span></h1>
        <form on:submit|preventDefault={transcribeAudio}>
            <input type="file" accept="audio/*" on:change="{e => audioFile = e.target?.files[0]}" />
            <button type="submit">Transcribe Audio</button>
            <div class='loader'>
                {#each $loaderFiles as file}
                    <progress max="100" value="{file.progress}"></progress>
                {/each}
            </div>
        </form>
    </header>
    <div class="video-container">
        <video bind:this={videoElement} controls></video>
        <div class="transcript" bind:this={captionElement}></div>
    </div>
</div>

<style lang="scss">
    .container {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }
    header {
        max-width: 60rem;
        width: 100%;
        display: flex;
        justify-self: center;
        align-items: center;
        justify-content: space-between;
        flex-direction: row;
        padding: 2rem 0 .2rem 0;
        border-bottom: 1px solid #888;
        h1 {
            display: flex;
            justify-items: center;
            font-size: 2rem;
            margin: 0;

            span {

                font-size: 1.5rem;
                line-height: 2.1rem;
                margin-left: .5rem;
            }
        }
        form {
            position: relative;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            flex-direction: row;

            .loader {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                display: flex;
                flex-direction: column;

                & > li {
                    padding: 0;
                    margin: 0;
                    list-style: none;
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                }
            }
        }
    }
    .video-container {
        position: relative;
        width: 30rem;
        height: 16.875rem;
        video {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            height: 100%;
        }

        .transcript {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            text-align: center;
        }
    }
</style>