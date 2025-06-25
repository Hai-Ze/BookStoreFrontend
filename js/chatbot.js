// Hàm gọi backend Node.js để lấy kết quả chat
window.runRAG = async function(query) {
    try {
        const response = await fetch('http://localhost:3001/rag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        if (data.result) return data.result;
        if (data.error) return 'Lỗi: ' + data.error;
        return 'Không nhận được phản hồi từ server.';
    } catch (err) {
        return 'Không thể kết nối tới server.';
    }
};
