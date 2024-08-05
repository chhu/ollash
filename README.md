# ollash
Fun with Ollama Part 1: The all-knowing shell.

Requires a running Ollama. https://ollama.com/
Look for models supporting Tools!

```sh
git clone https://github.com/chhu/ollash.git
cd ollash
ollama pull mistral-nemo
npm i -g .
X What is my public IP address?

# Different model:
export OLLASH_MODEL=llama3.1
ollama pull llama3.1
X What is my public IP address?
```
