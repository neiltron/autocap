<script lang="ts">
    import {
        audioFile, captionFile, downloadSRT, downloadVTT,
        loaderFiles, phrases, transcribeAudio
    } from '$lib/store';
    import type { wordChunk } from '$lib/store';
	import type { ChangeEventHandler } from 'svelte/elements';

    let videoElement: HTMLVideoElement | null = null;
    let captionElement: HTMLDivElement | null = null;

    function handleFileChange(e: ChangeEventHandler<HTMLInputElement>): void {
        $audioFile = e.target.files![0];
    }

    async function processFile(): Promise<void> {
        const url: string | undefined = await transcribeAudio();

        if (!url) { return; }

        videoElement!.src = url;

        console.log($captionFile)
        const track = document.createElement('track');
        const captionUrl: string = (URL || webkitURL).createObjectURL($captionFile);
        Object.assign(track, {
            label: "English",
            default: true,
            kind: "captions",
            src: captionUrl
        });

        videoElement!.appendChild(track);
        track.srclang = "en";
        track.mode = "showing";
        videoElement!.textTracks[0].mode = "showing";

        videoElement?.addEventListener('timeupdate', () => {
            const currentTime = videoElement!.currentTime;

            const currentPhrase: wordChunk | undefined = $phrases.find(phrase => {
                return phrase.timestamp[0] <= currentTime && phrase.timestamp[1] >= currentTime;
            });

            if (currentPhrase) {
                captionElement!.innerText = currentPhrase.text;
            }
        });
    };
</script>

<div class='container'>
    <header>
        <h1>🧢 <span>autocap</span></h1>
        <form on:submit|preventDefault={processFile}>
            <input type="file" accept="audio/*" on:change={handleFileChange} />
            <button type="submit">Transcribe Audio</button>

            {#if $loaderFiles.length > 0}
                <ul class='loader'>
                    {#each $loaderFiles as file}
                        <li>{file.name}</li>
                    {/each}
                </ul>
            {/if}
        </form>
    </header>
    <div class="video-container">
        <video bind:this={videoElement} controls></video>
        <div class="transcript" bind:this={captionElement}></div>
    </div>
    <button class="download-srt" on:click={downloadSRT}>Download SRT</button>
    <button class="download-vtt" on:click={downloadVTT}>Download VTT</button>
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
        margin-top: 2rem;
        video {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
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