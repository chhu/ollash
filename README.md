# ollash
Fun with Ollama Part 1: The all-knowing shell.

Idea is to self-improve from answers of the executed shell command. So far only mistral-large shows signs of "intelligence". Llama3.1 70B seems very bad. mistral-v3 and mistral-nemo surprisingly good for fast response. 

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
