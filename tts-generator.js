import { audioLibrary } from './audio-data.js';

export class TTSGenerator {
    constructor(room) {
        this.room = room;
        this.allTags = [...new Set(audioLibrary.flatMap(x => x.tags))];
        this.voices = [
            { value: "en-male", text: "English - Male" },
            { value: "en-female", text: "English - Female" },
            { value: "es-male", text: "Spanish - Male" },
            { value: "es-female", text: "Spanish - Female" },
            { value: "fr-male", text: "French - Male" },
            { value: "fr-female", text: "French - Female" },
            { value: "de-male", text: "German - Male" },
            { value: "de-female", text: "German - Female" },
            { value: "it-male", text: "Italian - Male" },
            { value: "it-female", text: "Italian - Female" },
            { value: "pt-male", text: "Portuguese - Male" },
            { value: "pt-female", text: "Portuguese - Female" },
            { value: "ru-male", text: "Russian - Male" },
            { value: "ru-female", text: "Russian - Female" },
        ];

        this.elements = {
            generator: document.getElementById('tts-generator'),
            button: document.getElementById('generate-tts-btn'),
            textInput: document.getElementById('tts-text'),
            voiceSelect: document.getElementById('tts-voice'),
            submitBtn: document.getElementById('generate-tts-submit')
        };

        this.isOpen = false;
    }

    populateVoices() {
        this.elements.voiceSelect.innerHTML = '';
        this.voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.value;
            option.textContent = voice.text;
            this.elements.voiceSelect.appendChild(option);
        });
    }

    toggle() {
        this.isOpen = !this.elements.generator.classList.contains('hidden');
        this.elements.generator.classList.toggle('hidden');
        this.elements.button.classList.toggle('active', !this.elements.generator.classList.contains('hidden'));

        if (!this.elements.generator.classList.contains('hidden')) {
            this.populateVoices();
        }

        return !this.elements.generator.classList.contains('hidden');
    }

    close() {
        this.elements.generator.classList.add('hidden');
        this.elements.button.classList.remove('active');
        this.isOpen = false;
    }

    setLoading(isLoading) {
        const btnText = this.elements.submitBtn.querySelector('.btn-text');
        const loader = this.elements.submitBtn.querySelector('.loader');
        this.elements.submitBtn.disabled = isLoading;
        if (isLoading) {
            btnText.classList.add('hidden');
            loader.classList.remove('hidden');
        } else {
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
        }
    }

    async submit() {
        const text = this.elements.textInput.value.trim();
        if (!text) {
            alert("Please enter some text.");
            return;
        }

        this.setLoading(true);
        try {
            const result = await websim.textToSpeech({
                text,
                voice: this.elements.voiceSelect.value,
            });

            let aiTag = null;
            try {
                const completion = await websim.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert asset tagger. Your task is to categorize the given text with a single, most relevant tag from the provided list. The text is for a Text-to-Speech audio clip. Respond with a JSON object like {"tag": "chosen_tag"} and nothing else. The chosen tag must be one of the tags from the list provided.`,
                        },
                        {
                            role: 'user',
                            content: `Here is the list of tags: ${JSON.stringify(this.allTags)}. Here is the text: "${text}".`,
                        },
                    ],
                    json: true,
                });

                const response = JSON.parse(completion.content);
                if (response.tag && this.allTags.includes(response.tag)) {
                    aiTag = response.tag;
                }
            } catch (tagError) {
                console.error("Failed to get AI tag for TTS:", tagError);
            }

            const currentUser = await window.websim.getCurrentUser();
            const userRecords = this.room.collection('user_data_v2').getList();
            const userRecord = userRecords.find(r => r.username === currentUser.username);

            const newTtsId = 'tts_' + Date.now() + Math.random().toString(36).substring(2, 9);
            const newTtsAsset = {
                name: `TTS: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
                src: result.url,
                text,
                voice: this.elements.voiceSelect.value,
                tags: ['tts', 'user-generated']
            };

            if (aiTag) {
                newTtsAsset.tags.push(aiTag);
            }

            if (userRecord) {
                const newTtsAssets = { ...(userRecord.tts_assets || {}), [newTtsId]: newTtsAsset };
                await this.room.collection('user_data_v2').update(userRecord.id, { tts_assets: newTtsAssets });
            } else {
                await this.room.collection('user_data_v2').create({
                    tts_assets: { [newTtsId]: newTtsAsset },
                    favorites: {},
                    image_assets: {}
                });
            }

            this.elements.textInput.value = '';
            this.close();

        } catch (error) {
            console.error("Failed to generate TTS:", error);
            alert("Sorry, there was an error generating the audio.");
        } finally {
            this.setLoading(false);
        }
    }
}