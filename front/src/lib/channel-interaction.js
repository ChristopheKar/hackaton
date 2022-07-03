import axios from 'axios';
import TonWeb from 'tonweb';

const apiUrl = 'http://localhost:8080';

export const getServerWallet = () => {

  return axios.get('/get-server-wallet', {
    baseURL: apiUrl
  })
  .then((res) => {
    return {
      ...res?.data,
      address: {
        ...res?.data?.address,
        hashPart: Uint8Array.from(Object.values(res?.data?.address?.hashPart));
      },
      keyPair: {
        ...res?.data?.keyPair,
        publicKey: TonWeb.utils.base64ToBytes(res?.data?.keyPair?.publicKey)
      }
    }
  })
  .catch((err) => {
    throw err;
  })

}
