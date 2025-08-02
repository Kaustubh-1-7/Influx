// lib/ipfsHelper.js
import axios from 'axios';
import { PINATA_API_KEY, PINATA_API_SECRET } from './constants'; // Import from new config

const pinataBaseURL = 'https://api.pinata.cloud';

export const uploadJsonToIPFS = async (jsonData) => {
    if (!PINATA_API_KEY || !PINATA_API_SECRET) {
        throw new Error("Pinata API Key or Secret is not configured.");
    }
    const url = `${pinataBaseURL}/pinning/pinJSONToIPFS`;
    try {
        const response = await axios.post(url, jsonData, {
            headers: {
                'Content-Type': 'application/json',
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_API_SECRET,
            },
        });
        if (response.data.IpfsHash) {
            return response.data.IpfsHash;
        } else {
            throw new Error("IPFS Hash not found in Pinata response");
        }
    } catch (error) {
        console.error('Error uploading JSON to Pinata:', error.response ? error.response.data : error.message);
        throw error;
    }
};

export const fetchFromIPFS = async (cid) => {
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
    try {
        const response = await fetch(gatewayUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch from IPFS gateway (${response.status}): ${cid}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching from IPFS:', error);
        throw error;
    }
};