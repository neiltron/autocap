<script lang="ts">
    import {
        audioFile, captionFile, downloadSRT, downloadVTT,
        getClosedCaptionBlob, loaderFiles, phrases, transcribeAudio
    } from '$lib/store';
    import type { wordChunk } from '$lib/store';
	import type { ChangeEventHandler } from 'svelte/elements';

    let videoElement: HTMLVideoElement | null = null;
    let captionElement: HTMLDivElement | null = null;
    let editingIndex = -1;
    let editedText = "";
    let editingWidth = 0;
    let currentTime = -1;
    let isProcessing = false;

    function handleFileChange(e: ChangeEventHandler<HTMLInputElement>): void {
        $audioFile = e.target.files![0];
    }

    async function processFile(): Promise<void> {
        isProcessing = true;

        const url: string | undefined = await transcribeAudio();

        if (!url) { return; }

        videoElement!.src = url;

        createSubtitleTrack();

        videoElement?.addEventListener('timeupdate', () => {
            currentTime = videoElement!.currentTime;

            const currentPhrase: wordChunk | undefined = $phrases.find(phrase => {
                return phrase.timestamp[0] <= currentTime && phrase.timestamp[1] >= currentTime;
            });

            if (currentPhrase) {
                captionElement!.innerText = currentPhrase.text;
            }
        });
    };

    function createSubtitleTrack() {
        // cleanup
        const existingTracks: NodeListOf<HTMLTrackElement> | undefined = videoElement?.querySelectorAll('track');

        if (existingTracks && existingTracks.length > 0) {
            existingTracks.forEach(track => track.remove());
        }

        // update CC file/blob
        getClosedCaptionBlob();

        const track = document.createElement('track');
        const captionUrl: string = (URL || webkitURL).createObjectURL($captionFile);
        Object.assign(track, {
            label: "English",
            default: true,
            kind: "captions",
            src: captionUrl,
            srclang: "en",
            mode: 'showing',
        });

        videoElement!.appendChild(track);
    }

    function editChunk(index: number, text: string, el: Event) {
        if (editingIndex === index) { return; }

        const parentNode: HTMLElement = el.target?.parentNode;
        editingIndex = index;
        editedText = text;


        editingWidth = parentNode.offsetWidth;

        // wait a lil frame
        setTimeout(() => {
            parentNode?.querySelector('input')?.focus();
        }, 10);
    }

    function doneEditing(index: number) {
        if (editedText !== $phrases[index].text) {
            // change happened. do a callback
            handleEditChange(index, $phrases[index].timestamp, editedText);
        }

        // reset editing state
        editingIndex = -1;
    }

    function handleEditChange(index: number, timestamp: number[], newText: string) {
        $phrases[index].text = newText;

        setTimeout(() => {
            createSubtitleTrack();
        }, 10);
    }

    function roundTimestamp(timestamp: number): number {
        return Math.floor(timestamp * 1000) / 1000;
    }
</script>



{#if !$captionFile}
<main>
    <h1>🧢 <span>autocap</span></h1>
    <form on:submit|preventDefault={processFile}>
        <input type="file" accept="audio/*" on:change={handleFileChange} />
        <button type="submit">{isProcessing ? 'Loading...' : 'Transcribe Audio'}</button>

        {#if $loaderFiles.length > 0}
            <ul class='loader'>
                {#each $loaderFiles as file}
                    <li>{file}</li>
                {/each}
            </ul>
        {/if}
    </form>
</main>
{:else}
<div class='container hasFile'>
    <header>
        <h1>🧢</h1>

        <div>
            <button class="download-srt" on:click={downloadSRT}>Download SRT</button>
            <button class="download-vtt" on:click={downloadVTT}>Download VTT</button>
        </div>
    </header>
    <div class="video-container">
        <!-- svelte-ignore a11y-media-has-caption -->
        <video bind:this={videoElement} controls></video>
    </div>
</div>
{/if}

<div class="editor-area">
    {#each $phrases as phrase, index}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="chunk"
            class:editing={index === editingIndex}
            class:active={currentTime < phrase.timestamp[1] && currentTime > phrase.timestamp[0]}
            on:click={(e) => editChunk(index, phrase.text, e)}
        >
            {#if index === editingIndex}
                <input
                    type="text"
                    style={`width: ${editingWidth}px;`}
                    bind:value={editedText}
                    on:blur={() => doneEditing(index)}
                    on:keydown={(e) => {
                        if (e.key === 'Enter') {
                            doneEditing(index)
                        }
                    }}
                />
            {:else}
                <span>{phrase.text}</span>
            {/if}
            <div class="timestamp">{roundTimestamp(phrase.timestamp[0])} - {roundTimestamp(phrase.timestamp[1])}</div>
        </div>
    {/each}
</div>

<style lang="scss">
    :global(body, html) {
        min-height: 100vh;
        margin: 0;
        padding: 0;
    }

    :global(body) {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-content: center;
        font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }

    main {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100vh;
        align-items: center;
        justify-content: center;

        h1 {
            display: flex;
            flex-direction: column;
            text-align: center;
            font-size: 10rem;
            line-height: .85;
            margin-top: 0;
            margin-bottom: 4rem;

            span {
                font-size: 5rem;
            }
        }
        form {
            position: relative;
            border: 1px solid #aaa;
            border-radius: 3px;
            padding: 1rem;

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

    .container {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        z-index: 2;

        &.hasFile {
            position: sticky;
            top: 0px;
            header {
                position: fixed;
                top: 0;
                z-index: 3;
            }
        }
    }

    header {
        width: 100%;
        display: flex;
        justify-self: center;
        align-items: center;
        justify-content: space-between;
        flex-direction: row;
        mix-blend-mode: screen;
        margin: .2rem;

        h1 {
            display: flex;
            margin-left: .75rem;
            justify-items: center;
            font-size: 2rem;
            margin: 0 0 0 .5rem;

            span {
                font-size: 1.5rem;
                line-height: 2.1rem;
                margin-left: .5rem;
            }
        }

        & > div {
            margin-right: .75rem;
        }
    }
    .video-container {
        position: relative;
        width: 100%;
        video {
            width: 100%;
            max-height: 50vh;
            background-color: #000;
        }
    }

    .editor-area {
        max-width: 80rem;
        margin: 0 auto;
        padding: .5rem;

        .chunk {
            display: inline-block;
            position: relative;
            margin-right: .1rem;
            margin-bottom: .5rem;
            border-top: 4px solid #aaa;
            background-color: #222;
            padding: .4rem;
            color: #fafafa;

            span, input {
                box-sizing: content-box;
                padding: 0;
                margin: 0;
                font-size: 1.5rem;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                border: 1px solid transparent;
                word-spacing: normal;
            }

            .timestamp {
                font-family: monospace;
                background-color: #eee;
                color: #333;
                border-radius: .5rem;
                display: block;
                width: fit-content;
                padding: .1rem .2rem;
                margin-top: .5rem;
            }

            &.editing {
                border-top: 4px solid #497de9;

                span, input {
                    border: 0;
                }
            }

            &.active {
                border-top: 4px solid #000;
            }
        }
    }
</style>